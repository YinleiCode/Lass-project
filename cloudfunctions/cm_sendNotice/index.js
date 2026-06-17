// 发送订阅消息
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const TEMPLATE_MAP = {
  courseReminder: process.env.COURSE_REMINDER_TEMPLATE_ID || ''
}

const PAGE_MAP = {
  courseReminder: 'pages/parent/home/home'
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

async function hasScheduleAccess(studentId, teacherId) {
  if (!studentId || !teacherId) return false
  const res = await db.collection('schedules')
    .where({
      teacher_id: teacherId,
      student_ids: _.all([studentId])
    })
    .limit(1)
    .get()
  return res.data.length > 0
}

exports.main = async (event, context) => {
  const { type, toUser, data } = event

  if (!type || !toUser || !data) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const { openid, teacher } = await requireTeacher()
    const templateId = TEMPLATE_MAP[type]
    if (!templateId) {
      return { success: false, message: '订阅消息模板未配置', code: 400 }
    }

    const parentRes = await db.collection('students').where({
      parent_openid: toUser
    }).limit(20).get()
    if (parentRes.data.length === 0) {
      return { success: false, message: '接收人不是已绑定家长', code: 403 }
    }
    if (!isAdminTeacher(teacher)) {
      let allowed = false
      for (const student of parentRes.data) {
        if (hasTeacherAccess(student, teacher, openid) || await hasScheduleAccess(student._id, teacher._id)) {
          allowed = true
          break
        }
      }
      if (!allowed) {
        return { success: false, message: '只能给自己学员的家长发送提醒', code: 403 }
      }
    }

    const result = await cloud.openapi.subscribeMessage.send({
      touser: toUser,
      templateId,
      page: PAGE_MAP[type] || '',
      data: data
    })

    return { success: true, result: result }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('发送消息失败', err)
    return { success: false, message: err.message }
  }
}
