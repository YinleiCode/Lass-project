// 管理员读取学员操作记录
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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

exports.main = async (event = {}) => {
  try {
    const { teacher } = await requireTeacher()
    if (!isAdminTeacher(teacher)) {
      return { success: false, message: '仅管理员可查看学员操作记录', code: 403, data: [] }
    }

    const limit = Math.min(Math.max(Number(event.limit || 20) || 20, 1), 100)
    const res = await db.collection('student_audit_logs')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get()

    return { success: true, data: res.data || [] }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code, data: [] }
    }
    console.error('读取学员操作记录失败', err)
    return { success: false, message: err.message || '读取学员操作记录失败', data: [] }
  }
}
