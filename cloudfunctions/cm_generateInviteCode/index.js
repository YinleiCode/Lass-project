// 生成邀请码 - 仅管理员可调用
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { teacher } = await requireTeacher()
    if (!teacher.is_admin) {
      return { success: false, message: '仅管理员可生成邀请码', code: 403 }
    }

    // 生成6位不重复数字验证码
    let code = ''
    let attempts = 0
    while (attempts < 10) {
      code = String(100000 + Math.floor(Math.random() * 900000))
      const exist = await db.collection('invite_codes').where({
        code,
        used_by: null
      }).get()
      if (exist.data.length === 0) break
      attempts++
    }
    if (attempts >= 10) {
      return { success: false, message: '生成失败，请重试' }
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    await db.collection('invite_codes').add({
      data: {
        code,
        created_by: teacher.openid,
        created_at: db.serverDate(),
        expires_at: expiresAt.toISOString(),
        used_by: null
      }
    })

    return {
      success: true,
      code,
      expires_at: expiresAt.toISOString()
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('生成邀请码失败', err)
    return { success: false, message: err.message }
  }
}