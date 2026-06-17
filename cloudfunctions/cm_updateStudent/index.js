// 更新学员信息
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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

function hasTeacherAccess(student, teacher, openid) {
  if (!student || !teacher) return false
  if (student.owner_teacher_id && student.owner_teacher_id === teacher._id) return true
  if (student.owner_teacher_openid && student.owner_teacher_openid === openid) return true
  if (Array.isArray(student.teacher_ids) && student.teacher_ids.includes(teacher._id)) return true
  return false
}

function changedFields(before, after) {
  const keys = Object.keys(after || {}).filter(key => key !== 'updated_at')
  const result = {}
  for (const key of keys) {
    result[key] = {
      before: before ? before[key] : undefined,
      after: after[key]
    }
  }
  return result
}

async function hasLegacyScheduleAccess(studentId, teacherId) {
  if (!studentId || !teacherId) return false
  const res = await db.collection('schedules')
    .where({
      teacher_id: teacherId,
      student_ids: _.all([studentId])
    })
    .limit(1)
    .get()
  return res.data.length > 0
}

async function createAuditLog({ action, teacher, openid, studentId, studentName, before, after, changes }) {
  const data = {
    action,
    student_id: studentId || '',
    student_name: studentName || '',
    teacher_id: teacher && teacher._id ? teacher._id : '',
    teacher_name: teacher && teacher.name ? teacher.name : '老师',
    teacher_openid: openid || '',
    before: before || null,
    after: after || null,
    changes: changes || null,
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
  const { studentId, data = {} } = event

  if (!studentId) {
    return { success: false, message: '缺少学员ID' }
  }

  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)

    const studentRes = await db.collection('students').doc(studentId).get().catch(() => ({ data: null }))
    const student = studentRes.data
    if (!student) return { success: false, message: '学员不存在' }
    if (!isAdmin) {
      const legacyAccess = await hasLegacyScheduleAccess(studentId, teacher._id)
      if (!hasTeacherAccess(student, teacher, openid) && !legacyAccess) {
        return { success: false, message: '无权限操作其他老师的学员', code: 403 }
      }
    }

    const allowedFields = [
      'name', 'parent_name', 'parent_phone', 'phone', 'gender',
      'birthday', 'school', 'grade', 'tags', 'remark', 'status'
    ]
    const updateData = {}

    for (const key of allowedFields) {
      if (data[key] !== undefined) updateData[key] = data[key]
    }

    if (updateData.name !== undefined) {
      updateData.name = String(updateData.name).trim()
      if (!updateData.name || updateData.name.length > 30) return { success: false, message: '学员姓名不合法' }
    }
    if (updateData.parent_phone !== undefined && !/^1\d{10}$/.test(String(updateData.parent_phone))) {
      return { success: false, message: '家长手机号格式不正确' }
    }
    if (updateData.status !== undefined && !['active', 'archived'].includes(updateData.status)) {
      return { success: false, message: '学员状态不合法' }
    }
    if (updateData.tags !== undefined) {
      if (!Array.isArray(updateData.tags)) return { success: false, message: '标签格式不正确' }
      updateData.tags = updateData.tags.slice(0, 10).map(t => String(t).trim()).filter(Boolean).slice(0, 10)
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, message: '没有可更新字段' }
    }

    updateData.updated_at = db.serverDate()

    await db.collection('students').doc(studentId).update({ data: updateData })
    await createAuditLog({
      action: 'update',
      teacher,
      openid,
      studentId,
      studentName: updateData.name || student.name || '',
      before: student,
      after: updateData,
      changes: changedFields(student, updateData)
    })

    return { success: true, message: '已更新' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('更新学员失败', err)
    return { success: false, message: err.message }
  }
}
