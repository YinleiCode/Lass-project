// 云函数身份校验工具
const cloud = require('wx-server-sdk')

async function requireTeacher() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw { code: 401, message: '未登录' }

  const db = cloud.database()
  const result = await db.collection('teachers')
    .where({ openid: OPENID })
    .limit(1)
    .get()

  if (result.data.length === 0) {
    throw { code: 403, message: '无权限：仅老师可调用' }
  }
  return { openid: OPENID, teacher: result.data[0] }
}

function isAuthError(err) {
  return err && (err.code === 401 || err.code === 403)
}

module.exports = { requireTeacher, isAuthError }
