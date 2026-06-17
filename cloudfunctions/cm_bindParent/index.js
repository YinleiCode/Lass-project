// 家长身份绑定
const cloud = require('wx-server-sdk')
const { requireAnyUser, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const BIND_ATTEMPT_LIMIT = 10
const BIND_ATTEMPT_WINDOW_MS = 60 * 60 * 1000

function isCollectionMissing(err) {
  const msg = String((err && (err.message || err.errMsg)) || '')
  return err && (err.errCode === -502005 || err.code === -502005 || msg.includes('-502005') || msg.includes('collection') && msg.includes('not exists'))
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (err.errCode === -502005 || msg.includes('already exists') || msg.includes('exist')) return
    throw err
  }
}

async function cleanupBindAttempts() {
  const expiredBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  try {
    await db.collection('parent_bind_attempts').where({
      created_at: _.lt(expiredBefore)
    }).remove()
  } catch (err) {
    if (isCollectionMissing(err)) {
      await ensureCollection('parent_bind_attempts').catch(e => console.warn('创建 parent_bind_attempts 失败', e))
      return
    }
    console.warn('清理家长绑定尝试记录失败', err)
  }
}

async function checkBindRateLimit(openid) {
  const since = new Date(Date.now() - BIND_ATTEMPT_WINDOW_MS).toISOString()
  try {
    const res = await db.collection('parent_bind_attempts').where({
      openid,
      created_at: _.gte(since)
    }).count()
    if (res.total >= BIND_ATTEMPT_LIMIT) {
      throw { code: 429, message: '尝试次数过多，请稍后再试' }
    }
  } catch (err) {
    if (err && err.code === 429) throw err
    if (isCollectionMissing(err)) {
      await ensureCollection('parent_bind_attempts').catch(e => console.warn('创建 parent_bind_attempts 失败', e))
      return
    }
    throw err
  }
}

async function recordBindAttempt({ openid, studentName, parentPhone, success }) {
  try {
    await db.collection('parent_bind_attempts').add({
      data: {
        openid,
        student_name: studentName,
        parent_phone: parentPhone,
        success: !!success,
        created_at: new Date().toISOString()
      }
    })
  } catch (err) {
    if (isCollectionMissing(err)) {
      await ensureCollection('parent_bind_attempts').catch(e => console.warn('创建 parent_bind_attempts 失败', e))
    }
  }
}

exports.main = async (event, context) => {
  const studentName = (event.studentName || '').trim()
  const parentPhone = (event.parentPhone || '').trim()

  if (!studentName || !parentPhone) {
    return { success: false, message: '请输入孩子姓名和手机号' }
  }

  try {
    const { openid } = await requireAnyUser()
    await cleanupBindAttempts()
    await checkBindRateLimit(openid)

    const matchedRes = await db.collection('students').where({
      name: studentName,
      parent_phone: parentPhone
    }).get()
    const matchedIds = (matchedRes.data || []).map(s => s._id).filter(Boolean)

    const matchedStudents = await db.runTransaction(async transaction => {
      const rows = []
      for (const id of matchedIds) {
        const doc = await transaction.collection('students').doc(id).get().catch(() => ({ data: null }))
        if (
          doc.data &&
          doc.data.name === studentName &&
          doc.data.parent_phone === parentPhone
        ) {
          rows.push(doc.data)
        }
      }
      const res = { data: rows }

      if (res.data.length === 0) {
        throw new Error('未找到匹配的学员，请联系老师确认信息')
      }

      const occupied = res.data.find(s => s.parent_openid && s.parent_openid !== openid)
      if (occupied) {
        throw new Error('该学员已绑定家长，请联系老师处理')
      }

      for (const student of res.data) {
        if (student.parent_openid === openid) continue
        await transaction.collection('students').doc(student._id).update({
          data: {
            parent_openid: openid,
            parent_bound_at: db.serverDate(),
            updated_at: db.serverDate()
          }
        })
      }

      return res.data
    })

    await recordBindAttempt({ openid, studentName, parentPhone, success: true })

    return {
      success: true,
      message: '绑定成功',
      student: {
        _id: matchedStudents[0]._id,
        name: matchedStudents[0].name,
        parent_phone: matchedStudents[0].parent_phone
      },
      students: matchedStudents.map(s => ({ _id: s._id, name: s.name }))
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    try {
      const { openid } = await requireAnyUser()
      await recordBindAttempt({ openid, studentName, parentPhone, success: false })
    } catch (recordErr) {}
    console.error('绑定失败', err)
    return { success: false, message: '绑定失败: ' + err.message, code: err.code }
  }
}
