// 云函数身份校验工具
const cloud = require('wx-server-sdk')

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

async function requireAdmin() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw { code: 401, message: '未登录' }

  const db = cloud.database()
  const result = await db.collection('teachers')
    .where({ openid: OPENID })
    .limit(1)
    .get()

  if (result.data.length === 0 || !isAdminTeacher(result.data[0])) {
    throw { code: 403, message: '无权限：仅管理员可调用' }
  }
  return { openid: OPENID, teacher: result.data[0] }
}

function isAuthError(err) {
  return err && (err.code === 401 || err.code === 403)
}

module.exports = { requireAdmin, isAuthError }
