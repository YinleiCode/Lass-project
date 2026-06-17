// 新增学员
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function isCollectionMissing(err) {
  const msg = String((err && (err.message || err.errMsg)) || '')
  return err && (err.errCode === -502005 || err.code === -502005 || msg.includes('-502005'))
}

async function ensureAuditCollection() {
  try {
    await db.createCollection('student_audit_logs')
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (msg.includes('exist')) return
    throw err
  }
}

async function createAuditLog({ action, teacher, openid, studentId, studentName, before, after }) {
  const data = {
    action,
    student_id: studentId || '',
    student_name: studentName || '',
    teacher_id: teacher && teacher._id ? teacher._id : '',
    teacher_name: teacher && teacher.name ? teacher.name : '老师',
    teacher_openid: openid || '',
    before: before || null,
    after: after || null,
    created_at: db.serverDate()
  }
  try {
    await db.collection('student_audit_logs').add({ data })
  } catch (err) {
    try {
      if (!isCollectionMissing(err)) throw err
      await ensureAuditCollection()
      await db.collection('student_audit_logs').add({ data })
    } catch (retryErr) {
      console.warn('写入学员操作记录失败', retryErr)
    }
  }
}

exports.main = async (event, context) => {
  const name = (event.name || '').trim()
  const parent_name = (event.parent_name || '').trim()
  const parent_phone = (event.parent_phone || '').trim()
  const { enroll_date } = event
  const tags = Array.isArray(event.tags) ? event.tags : []
  const remark = event.remark || ''

  if (!name) {
    return { success: false, message: '请输入学员姓名' }
  }
  if (name.length > 30) return { success: false, message: '学员姓名过长' }
  if (parent_phone && !/^1\d{10}$/.test(parent_phone)) return { success: false, message: '家长手机号格式不正确' }

  try {
    const { openid, teacher } = await requireTeacher()

    const data = {
      name,
      parent_name,
      parent_phone,
      owner_teacher_id: teacher._id || '',
      owner_teacher_openid: openid || '',
      owner_teacher_name: teacher.name || '老师',
      teacher_ids: teacher._id ? [teacher._id] : [],
      enroll_date: enroll_date || '',
      tags: tags.slice(0, 10).map(t => String(t).trim()).filter(Boolean).slice(0, 10),
      remark: String(remark).slice(0, 500),
      total_attended: 0,
      status: 'active',
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }

    const res = await db.collection('students').add({ data })
    await createAuditLog({
      action: 'create',
      teacher,
      openid,
      studentId: res._id,
      studentName: name,
      after: data
    })

    return { success: true, message: '添加成功', studentId: res._id }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('新增学员失败', err)
    return { success: false, message: err.message }
  }
}
