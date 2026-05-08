// 验证邀请码 - 新老师输入邀请码注册
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { code, name } = event

  if (!code || !name) {
    return { success: false, message: '请输入邀请码和姓名' }
  }

  if (!/^\d{6}$/.test(code)) {
    return { success: false, message: '邀请码为6位数字' }
  }

  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) {
      return { success: false, message: '未登录', code: 401 }
    }

    // 查找有效邀请码
    const res = await db.collection('invite_codes').where({
      code,
      used_by: null
    }).get()

    if (res.data.length === 0) {
      return { success: false, message: '邀请码无效或已使用' }
    }

    const invite = res.data[0]
    const now = new Date()
    const expiresAt = new Date(invite.expires_at)

    if (now > expiresAt) {
      return { success: false, message: '邀请码已过期' }
    }

    // 检查该微信是否已注册为老师
    const existing = await db.collection('teachers').where({ openid: OPENID }).get()
    if (existing.data.length > 0) {
      return { success: false, message: '该微信号已注册为老师' }
    }

    // 写入 teachers 表
    await db.collection('teachers').add({
      data: {
        openid: OPENID,
        name,
        created_at: db.serverDate(),
        is_admin: false
      }
    })

    // 标记邀请码已使用
    await db.collection('invite_codes').doc(invite._id).update({
      data: {
        used_by: OPENID,
        used_at: db.serverDate()
      }
    })

    return { success: true, message: '注册成功' }
  } catch (err) {
    console.error('验证邀请码失败', err)
    return { success: false, message: err.message }
  }
}