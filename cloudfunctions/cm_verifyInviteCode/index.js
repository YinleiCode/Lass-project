// 验证邀请码 - 新老师输入邀请码注册
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function isCollectionMissing(err) {
  const msg = String((err && (err.message || err.errMsg)) || '')
  return err && (err.errCode === -502005 || err.code === -502005 || msg.includes('-502005') || msg.includes('collection') && msg.includes('not exists'))
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (err.errCode === -502005 || msg.includes('already exists')) return
    if (msg.includes('exist')) return
    throw err
  }
}

async function getTeacherByOpenid(openid) {
  const res = await db.collection('teachers').where({ openid }).limit(1).get()
  return res.data && res.data[0] ? res.data[0] : null
}

async function getInviteByCode(code) {
  try {
    const res = await db.collection('invite_codes').where({ code, used_by: null }).limit(1).get()
    return res.data && res.data[0] ? res.data[0] : null
  } catch (err) {
    if (isCollectionMissing(err)) throw new Error('邀请码功能未初始化，请管理员先生成邀请码')
    throw err
  }
}

function safeTeacherDocId(openid) {
  return `teacher_${openid}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)
}

exports.main = async (event, context) => {
  const code = (event.code || '').trim()
  const name = (event.name || '').trim()

  if (!code || !name) {
    return { success: false, message: '请输入邀请码和姓名' }
  }

  if (!/^[0-9a-fA-F]{8}$/.test(code)) {
    return { success: false, message: '邀请码为8位字母数字组合' }
  }

  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) {
      return { success: false, message: '未登录', code: 401 }
    }

    try {
      const expiredBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      await db.collection('invite_attempts').where({
        created_at: db.command.lt(expiredBefore)
      }).remove()
    } catch (cleanupErr) {
      if (isCollectionMissing(cleanupErr)) {
        await ensureCollection('invite_attempts').catch(err => console.warn('创建 invite_attempts 失败', err))
      } else {
        console.warn('清理邀请码尝试记录失败', cleanupErr)
      }
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    let attemptRes = { total: 0 }
    try {
      attemptRes = await db.collection('invite_attempts').where({
        openid: OPENID,
        created_at: db.command.gte(since)
      }).count()
    } catch (attemptErr) {
      if (isCollectionMissing(attemptErr)) {
        await ensureCollection('invite_attempts').catch(err => console.warn('创建 invite_attempts 失败', err))
      } else {
        throw attemptErr
      }
    }
    if (attemptRes.total >= 10) {
      return { success: false, message: '尝试次数过多，请稍后再试', code: 429 }
    }

    const existingTeacher = await getTeacherByOpenid(OPENID)
    const inviteOutside = await getInviteByCode(code)
    const fallbackTeacherId = safeTeacherDocId(OPENID)

    await db.runTransaction(async transaction => {
      if (existingTeacher) {
        const existingDoc = await transaction.collection('teachers').doc(existingTeacher._id).get()
          .catch(() => ({ data: null }))
        if (existingDoc.data && existingDoc.data.openid === OPENID) {
          throw new Error('该微信号已注册为老师')
        }
      }
      const fallbackTeacherDoc = await transaction.collection('teachers').doc(fallbackTeacherId).get()
        .catch(() => ({ data: null }))
      if (fallbackTeacherDoc.data && fallbackTeacherDoc.data.openid === OPENID) {
        throw new Error('该微信号已注册为老师')
      }

      if (!inviteOutside || !inviteOutside._id) throw new Error('邀请码无效或已使用')
      const inviteDoc = await transaction.collection('invite_codes').doc(inviteOutside._id).get()
        .catch(() => ({ data: null }))
      const invite = inviteDoc.data
      if (!invite || invite.code !== code) throw new Error('邀请码无效或已使用')
      const attemptCount = Number(invite.attempt_count || 0)
      if (invite.locked || attemptCount >= 5) throw new Error('邀请码尝试次数过多，已失效')
      if (invite.used_by) throw new Error('邀请码无效或已使用')
      if (new Date() > new Date(invite.expires_at)) {
        await transaction.collection('invite_codes').doc(invite._id).update({
          data: {
            attempt_count: attemptCount + 1,
            locked: attemptCount + 1 >= 5
          }
        })
        throw new Error('邀请码已过期')
      }

      await transaction.collection('invite_codes').doc(invite._id).update({
        data: {
          used_by: OPENID,
          used_at: db.serverDate()
        }
      })

      await transaction.collection('teachers').doc(fallbackTeacherId).set({
        data: {
          openid: OPENID,
          name,
          created_at: db.serverDate(),
          is_admin: false
        }
      })
    })

    return { success: true, message: '注册成功' }
  } catch (err) {
    try {
      const { OPENID } = cloud.getWXContext()
      if (OPENID) {
        await db.collection('invite_attempts').add({
          data: {
            openid: OPENID,
            code,
            created_at: new Date().toISOString()
          }
        })
      }
    } catch (e) {}
    console.error('验证邀请码失败', err)
    return { success: false, message: err.message }
  }
}
