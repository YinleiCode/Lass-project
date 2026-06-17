// 批量点名 - 原子操作
// 入参: { scheduleId, students: [{ id, status, deduct_count }] }
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const IN_QUERY_LIMIT = 100

function getStudentId(row) {
  return row.student_id || row.studentId || ''
}

function getPackageId(row) {
  return row.package_id || row.packageId || ''
}

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

function hasTeacherAccess(student, teacher, openid) {
  if (!student || !teacher) return false
  if (student.owner_teacher_id && student.owner_teacher_id === teacher._id) return true
  if (student.owner_teacher_openid && student.owner_teacher_openid === openid) return true
  if (Array.isArray(student.teacher_ids) && student.teacher_ids.includes(teacher._id)) return true
  return false
}

async function getTransactionDocsByIds(transaction, collectionName, ids) {
  const result = []
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)))
  for (const id of uniqueIds) {
    const res = await transaction.collection(collectionName).doc(id).get().catch(() => ({ data: null }))
    if (res.data) result.push(res.data)
  }
  return result
}

async function hasScheduleAccess(transaction, schedule, teacher, openid) {
  if (!schedule || !teacher) return false
  if (schedule.teacher_id) return schedule.teacher_id === teacher._id

  const studentIds = Array.isArray(schedule.student_ids)
    ? Array.from(new Set(schedule.student_ids.filter(Boolean)))
    : []
  if (!studentIds.length) return false

  const students = await getTransactionDocsByIds(transaction, 'students', studentIds)
  if (students.length !== studentIds.length) return false
  return students.every(student => hasTeacherAccess(student, teacher, openid))
}

function pickDeductBalance(balances, packageId, deduct) {
  const sorted = (balances || [])
    .filter(b => getPackageId(b) === packageId && Number(b.remaining || 0) > 0)
    .sort((a, b) => {
      const aUpdated = a.last_updated || a.created_at || ''
      const bUpdated = b.last_updated || b.created_at || ''
      return String(aUpdated).localeCompare(String(bUpdated))
    })
  return sorted.find(b => Number(b.remaining || 0) >= deduct) || null
}

function mergeRows(primaryRows, legacyRows) {
  const rows = []
  const seen = new Set()
  for (const row of [...(primaryRows || []), ...(legacyRows || [])]) {
    const key = row && row._id ? row._id : JSON.stringify(row)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }
  return rows
}

async function queryBalanceRows(studentIds, fieldName) {
  const ids = Array.from(new Set((studentIds || []).filter(Boolean)))
  const rows = []
  for (let i = 0; i < ids.length; i += IN_QUERY_LIMIT) {
    const batchIds = ids.slice(i, i + IN_QUERY_LIMIT)
    if (!batchIds.length) continue
    const res = await db.collection('course_balance')
      .where({ [fieldName]: _.in(batchIds) })
      .limit(100)
      .get()
    rows.push(...(res.data || []))
  }
  return rows
}

async function queryBalancesForStudents(studentIds) {
  const primaryRows = await queryBalanceRows(studentIds, 'student_id')
  const legacyRows = await queryBalanceRows(studentIds, 'studentId')
  return mergeRows(primaryRows, legacyRows)
}

async function getFreshDeductBalance(transaction, balance, studentId, packageId, deduct) {
  if (!balance || !balance._id) return null
  const res = await transaction.collection('course_balance').doc(balance._id).get().catch(() => ({ data: null }))
  const fresh = res.data
  if (!fresh) return null
  if (getStudentId(fresh) !== studentId || getPackageId(fresh) !== packageId) return null
  if (Number(fresh.remaining || 0) < deduct) return null
  return fresh
}

exports.main = async (event, context) => {
  const { scheduleId, students } = event

  if (!scheduleId || !students || !students.length) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)
    const submittedStudentIds = (students || []).map(stu => stu && stu.id).filter(Boolean)
    const prefetchedBalances = await queryBalancesForStudents(submittedStudentIds)

    await db.runTransaction(async transaction => {
      const scheduleRes = await transaction.collection('schedules').doc(scheduleId).get()
      const schedule = scheduleRes.data
      if (!schedule) throw new Error('排课不存在')
      if (!isAdmin && !await hasScheduleAccess(transaction, schedule, teacher, openid)) throw new Error('无权限点名该课程')
      if (schedule.status === 'done') throw new Error('该课程已点名，请勿重复操作')
      if (schedule.status !== 'pending') throw new Error('该课程当前不可点名')

      const allowedIds = Array.isArray(schedule.student_ids) ? schedule.student_ids : []
      const allowedSet = new Set(allowedIds)
      const submittedIds = new Set()
      const validStatuses = ['present', 'absent', 'leave']
      const studentRes = { data: await getTransactionDocsByIds(transaction, 'students', allowedIds) }
      const studentMap = {}
      for (const student of studentRes.data || []) {
        studentMap[student._id] = student.name || '学员'
      }

      for (const stu of students) {
        const studentName = studentMap[stu.id] || '学员'
        if (!allowedSet.has(stu.id)) throw new Error('包含不属于该排课的学员')
        if (submittedIds.has(stu.id)) throw new Error('存在重复学员')
        submittedIds.add(stu.id)

        const status = stu.status || 'present'
        if (!validStatuses.includes(status)) throw new Error('点名状态不合法')
        const defaultDeduct = status === 'present' ? 1 : 0
        const deduct = Number(stu.deduct_count !== undefined ? stu.deduct_count : defaultDeduct)
        if (!Number.isFinite(deduct) || deduct < 0 || deduct > 10) throw new Error('扣课时数不合法')

        if (deduct > 0) {
          if (!schedule.package_id) throw new Error('课程包信息缺失，无法扣课时')
          const balances = prefetchedBalances.filter(b => getStudentId(b) === stu.id)
          const packageRemaining = balances
            .filter(b => getPackageId(b) === schedule.package_id)
            .reduce((sum, b) => sum + Number(b.remaining || 0), 0)
          if (packageRemaining < deduct) throw new Error(`${studentName} 本课程包余课不足`)

          const balance = await getFreshDeductBalance(
            transaction,
            pickDeductBalance(balances, schedule.package_id, deduct),
            stu.id,
            schedule.package_id,
            deduct
          )
          if (!balance) throw new Error(`${studentName} 本课程包余课不足`)
          await transaction.collection('course_balance').doc(balance._id).update({
            data: {
              total_used: _.inc(deduct),
              remaining: _.inc(-deduct),
              last_updated: db.serverDate()
            }
          })
          stu._deduct_balance_id = balance._id
          stu._deduct_package_id = getPackageId(balance)
        }

        await transaction.collection('attendance').add({ data: {
          schedule_id: scheduleId,
          student_id: stu.id,
          status,
          deduct_count: deduct,
          deduct_balance_id: stu._deduct_balance_id || '',
          deduct_package_id: stu._deduct_package_id || schedule.package_id || '',
          attended_at: db.serverDate(),
          operated_by: openid
        } })

        if (status === 'present') {
          await transaction.collection('students').doc(stu.id).update({
            data: {
              total_attended: _.inc(1),
              updated_at: db.serverDate()
            }
          })
        }
      }

      await transaction.collection('schedules').doc(scheduleId).update({
        data: {
          status: 'done',
          checked_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      })
    })

    return { success: true, message: '点名成功' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('点名失败', err)
    return { success: false, message: '点名失败: ' + err.message }
  }
}
