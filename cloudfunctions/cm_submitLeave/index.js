// 家长提交请假
const cloud = require('wx-server-sdk')
const { requireAnyUser, isAuthError } = require('./auth')
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

function getChinaMinuteString() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const china = new Date(utc + 8 * 60 * 60000)
  const y = china.getFullYear()
  const m = String(china.getMonth() + 1).padStart(2, '0')
  const d = String(china.getDate()).padStart(2, '0')
  const hh = String(china.getHours()).padStart(2, '0')
  const mm = String(china.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

exports.main = async (event, context) => {
  const { student_id, schedule_id, reason } = event
  const remark = event.remark || event.notes || ''

  if (!student_id || !schedule_id || !reason) {
    return { success: false, message: '请填写完整信息' }
  }

  try {
    const { openid: OPENID } = await requireAnyUser()

    // 校验调用者是该学员家长；管理员测试家长视角允许提交。
    const teacherRes = await db.collection('teachers').where({ openid: OPENID }).limit(1).get()
    const isAdmin = teacherRes.data.length > 0 && isAdminTeacher(teacherRes.data[0])
    const studentRes = await db.collection('students').doc(student_id).get()
    const student = studentRes.data
    if (!student || (student.parent_openid !== OPENID && !isAdmin)) {
      return { success: false, message: '无权限：仅该学员家长可请假', code: 403 }
    }

    const scheduleRes = await db.collection('schedules').doc(schedule_id).get()
    const schedule = scheduleRes.data
    if (!schedule || !Array.isArray(schedule.student_ids) || !schedule.student_ids.includes(student_id)) {
      return { success: false, message: '课程不属于该学员', code: 403 }
    }
    if (schedule.status !== 'pending') {
      return { success: false, message: '该课程当前不可请假' }
    }
    if (schedule.start_time && schedule.start_time < getChinaMinuteString()) {
      return { success: false, message: '历史课程不能请假' }
    }

    const existing = await db.collection('leaves').where({
      student_id,
      schedule_id,
      status: _.neq('cancelled')
    }).limit(1).get()
    if (existing.data.length > 0) {
      return { success: false, message: '该课程已提交过请假' }
    }

    await db.collection('leaves').add({
      data: {
        student_id,
        schedule_id: schedule_id || '',
        reason,
        remark: remark || '',
        openid: OPENID,
        status: 'pending',
        created_at: db.serverDate()
      }
    })

    return { success: true, message: '请假已提交' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('提交请假失败', err)
    return { success: false, message: err.message }
  }
}
