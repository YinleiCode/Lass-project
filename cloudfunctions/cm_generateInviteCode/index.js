// 生成邀请码 - 仅管理员可调用
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function isCollectionMissing(err) {
  const msg = String((err && (err.message || err.errMsg)) || '')
  return err && (err.errCode === -502005 || err.code === -502005 || msg.includes('-502005'))
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (msg.includes('exist')) return
    throw err
  }
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

exports.main = async (event, context) => {
  try {
    const { teacher } = await requireTeacher()
    if (!isAdminTeacher(teacher)) {
      return { success: false, message: '仅管理员可生成邀请码', code: 403 }
    }

    // 生成8位十六进制一次性邀请码，空间更大，降低枚举风险
    let code = ''
    let attempts = 0
    while (attempts < 10) {
      code = crypto.randomBytes(4).toString('hex')
      let exist
      try {
        exist = await db.collection('invite_codes').where({
          code
        }).limit(1).get()
      } catch (err) {
        if (!isCollectionMissing(err)) throw err
        await ensureCollection('invite_codes')
        exist = { data: [] }
      }
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
        used_by: null,
        attempt_count: 0,
        locked: false
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
