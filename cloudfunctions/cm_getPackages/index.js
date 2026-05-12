// 读取课程包(管理端身份,绕过集合权限)
// event.activeOnly = true  → 只返回 is_active=true 的(用于排课/缴费选择)
// event.activeOnly = false → 返回所有(用于课程包管理页)
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    await requireTeacher()

    const activeOnly = event && event.activeOnly === true
    const query = activeOnly
      ? db.collection('course_packages').where({ is_active: true })
      : db.collection('course_packages')

    const res = await query.orderBy('created_at', 'desc').get()
    return { success: true, data: res.data }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code, data: [] }
    }
    console.error('读取课程包失败', err)
    return { success: false, message: err.message, data: [] }
  }
}
