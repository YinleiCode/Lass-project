// 撤销点名 - 回滚所有操作
// 入参: { scheduleId }
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const DB_PAGE_LIMIT = 100

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

async function getAttendanceRows(scheduleId) {
  const rows = []
  let skip = 0
  while (true) {
    const res = await db.collection('attendance')
      .where({ schedule_id: scheduleId })
      .skip(skip)
      .limit(DB_PAGE_LIMIT)
      .get()
    rows.push(...(res.data || []))
    if (!res.data || res.data.length < DB_PAGE_LIMIT) break
    skip += DB_PAGE_LIMIT
  }
  return rows
}

async function findBalanceOutsideTransaction(studentId, packageId) {
  if (!studentId || !packageId) return null
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
  const { scheduleId } = event

  if (!scheduleId) {
    return { success: false, message: '缺少排课ID' }
  }

  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)
    const prefetchedAttendances = await getAttendanceRows(scheduleId)
    const scheduleOutsideRes = await db.collection('schedules').doc(scheduleId).get().catch(() => ({ data: null }))
    const scheduleOutside = scheduleOutsideRes.data || {}
    const fallbackBalanceMap = {}
    for (const att of prefetchedAttendances) {
      const deduct = Number(att && att.deduct_count || 0)
      if (!att || att.deduct_balance_id || deduct <= 0) continue
      const fallback = await findBalanceOutsideTransaction(
        att.student_id,
        att.deduct_package_id || scheduleOutside.package_id
      )
      if (fallback && fallback._id) fallbackBalanceMap[att._id] = fallback._id
    }

    await db.runTransaction(async transaction => {
      const scheduleRes = await transaction.collection('schedules').doc(scheduleId).get()
      const schedule = scheduleRes.data
      if (!schedule) throw new Error('排课不存在')
      if (!isAdmin && !await hasScheduleAccess(transaction, schedule, teacher, openid)) throw new Error('无权限撤销该课程')
      if (schedule.status !== 'done') throw new Error('该课程未点名，无需撤销')

      const checkedTime = schedule.checked_at || schedule.updated_at || schedule.created_at
      const diffHours = (new Date() - new Date(checkedTime)) / (1000 * 60 * 60)
      if (diffHours > 24) throw new Error('已超过24小时，无法撤销')

      const attendances = []
      for (const item of prefetchedAttendances) {
        if (!item || !item._id) continue
        const attDoc = await transaction.collection('attendance').doc(item._id).get().catch(() => ({ data: null }))
        const att = attDoc.data
        if (att && att.schedule_id === scheduleId) attendances.push(att)
      }

      for (const att of attendances) {
        const deduct = Number(att.deduct_count || 0)
        if (deduct > 0) {
          let balance = null
          if (att.deduct_balance_id) {
            const balanceDoc = await transaction.collection('course_balance').doc(att.deduct_balance_id).get()
              .catch(() => ({ data: null }))
            balance = balanceDoc.data || null
          }

          if (!balance) {
            const fallbackBalanceId = fallbackBalanceMap[att._id]
            if (fallbackBalanceId) {
              const balanceDoc = await transaction.collection('course_balance').doc(fallbackBalanceId).get()
                .catch(() => ({ data: null }))
              balance = balanceDoc.data || null
            }
          }

          if (balance) {
            await transaction.collection('course_balance').doc(balance._id).update({
              data: {
                total_used: _.inc(-deduct),
                remaining: _.inc(deduct),
                last_updated: db.serverDate()
              }
            })
          }
        }

        if (att.status === 'present') {
          await transaction.collection('students').doc(att.student_id).update({
            data: {
              total_attended: _.inc(-1),
              updated_at: db.serverDate()
            }
          })
        }

        await transaction.collection('attendance').doc(att._id).remove()
      }

      await transaction.collection('schedules').doc(scheduleId).update({
        data: {
          status: 'pending',
          updated_at: db.serverDate()
        }
      })
    })

    return { success: true, message: '撤销成功，课时已恢复' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('撤销失败', err)
    return { success: false, message: '撤销失败: ' + err.message }
  }
}
