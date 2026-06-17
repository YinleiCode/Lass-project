// 创建缴费订单 + 更新课时余额
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function isAdminTeacher(teacher) {
  if (!teacher) return false
  const role = String(teacher.role || teacher.user_role || '').toLowerCase()
  return teacher.is_admin === true ||
    teacher.is_admin === 1 ||
    teacher.is_admin === 'true' ||
    teacher.is_admin === '1' ||
    teacher.isAdmin === true ||
    teacher.isAdmin === 1 ||
    teacher.isAdmin === 'true' ||
    teacher.isAdmin === '1' ||
    ['admin', 'super_admin', 'principal', 'owner'].includes(role)
}

function getStudentId(row) {
  return row.student_id || row.studentId || ''
}

function getPackageId(row) {
  return row.package_id || row.packageId || ''
}

function safeBalanceDocId(studentId, packageId) {
  const raw = `balance_${studentId}_${packageId}`
  return raw.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)
}

async function findBalance(studentId, packageId) {
  const primaryRes = await db.collection('course_balance').where({
    student_id: studentId,
    package_id: packageId
  }).limit(1).get()
  if (primaryRes.data && primaryRes.data[0]) return primaryRes.data[0]

  const legacyRes = await db.collection('course_balance').where({
    studentId: studentId,
    packageId: packageId
  }).limit(1).get()
  return legacyRes.data && legacyRes.data[0] ? legacyRes.data[0] : null
}

exports.main = async (event, context) => {
  const { studentId, packageId, courseCount, amount, payDate, payMethod, remark } = event
  const count = Number(courseCount)
  const orderAmount = Number(amount)

  if (!studentId || !packageId || !Number.isInteger(count) || count <= 0 || !Number.isFinite(orderAmount) || orderAmount <= 0) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const { teacher } = await requireTeacher()
    if (!isAdminTeacher(teacher)) {
      return { success: false, message: '无权限：仅校长/管理员可操作', code: 403 }
    }

    const existingBalance = await findBalance(studentId, packageId)
    const fallbackBalanceId = safeBalanceDocId(studentId, packageId)

    const result = await db.runTransaction(async transaction => {
      const studentRes = await transaction.collection('students').doc(studentId).get()
      const packageRes = await transaction.collection('course_packages').doc(packageId).get()
      if (!studentRes.data || studentRes.data.status === 'archived') {
        throw new Error('学员不存在或已结业')
      }
      if (!packageRes.data || packageRes.data.is_active === false) {
        throw new Error('课程包不存在或已停用')
      }

      const orderRes = await transaction.collection('orders').add({
        data: {
          student_id: studentId,
          package_id: packageId,
          course_count: count,
          amount: orderAmount,
          pay_date: payDate || new Date().toISOString().split('T')[0],
          pay_method: payMethod || '微信',
          remark: remark || '',
          created_at: db.serverDate()
        }
      })

      let balance = null
      if (existingBalance && existingBalance._id) {
        const balanceDoc = await transaction.collection('course_balance').doc(existingBalance._id).get()
          .catch(() => ({ data: null }))
        if (balanceDoc.data && getStudentId(balanceDoc.data) === studentId && getPackageId(balanceDoc.data) === packageId) {
          balance = balanceDoc.data
        }
      }

      if (!balance) {
        const fallbackDoc = await transaction.collection('course_balance').doc(fallbackBalanceId).get()
          .catch(() => ({ data: null }))
        if (fallbackDoc.data && getStudentId(fallbackDoc.data) === studentId && getPackageId(fallbackDoc.data) === packageId) {
          balance = fallbackDoc.data
        }
      }

      if (balance) {
        await transaction.collection('course_balance').doc(balance._id).update({
          data: {
            total_purchased: _.inc(count),
            remaining: _.inc(count),
            last_updated: db.serverDate()
          }
        })
      } else {
        await transaction.collection('course_balance').doc(fallbackBalanceId).set({ data: {
          student_id: studentId,
          package_id: packageId,
          total_purchased: count,
          total_used: 0,
          remaining: count,
          last_updated: db.serverDate()
        } })
      }

      return { orderId: orderRes._id }
    })

    return { success: true, message: '缴费已登记', orderId: result.orderId }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('缴费失败', err)
    return { success: false, message: '缴费失败: ' + err.message }
  }
}
