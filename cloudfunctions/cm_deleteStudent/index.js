// 删除学员及相关数据
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const DB_PAGE_LIMIT = 100

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

async function hasScheduleAccess(studentId, teacherId) {
  const res = await db.collection('schedules')
    .where({
      teacher_id: teacherId,
      student_ids: _.all([studentId])
    })
    .limit(1)
    .get()
  return res.data.length > 0
}

async function hasOtherTeacherSchedules(studentId, teacherId) {
  let skip = 0
  while (true) {
    const res = await db.collection('schedules')
      .where({ student_ids: _.all([studentId]) })
      .skip(skip)
      .limit(DB_PAGE_LIMIT)
      .get()
    for (const schedule of res.data || []) {
      if (schedule.teacher_id && schedule.teacher_id !== teacherId) return true
    }
    if (!res.data || res.data.length < DB_PAGE_LIMIT) break
    skip += DB_PAGE_LIMIT
  }
  return false
}

async function createAuditLog({ action, teacher, openid, studentId, studentName, before }) {
  const data = {
    action,
    student_id: studentId || '',
    student_name: studentName || '',
    teacher_id: teacher && teacher._id ? teacher._id : '',
    teacher_name: teacher && teacher.name ? teacher.name : '老师',
    teacher_openid: openid || '',
    before: before || null,
    after: null,
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

async function removeStudentRows(collectionName, fieldName, studentId) {
  while (true) {
    const res = await db.collection(collectionName).where({ [fieldName]: studentId }).limit(100).get()
    if (res.data.length === 0) break
    for (const item of res.data) {
      await db.collection(collectionName).doc(item._id).remove()
    }
  }
}

async function hasStudentRows(collectionName, studentId) {
  const primary = await db.collection(collectionName).where({ student_id: studentId }).limit(1).get()
  if (primary.data.length > 0) return true
  const legacy = await db.collection(collectionName).where({ studentId: studentId }).limit(1).get()
  return legacy.data.length > 0
}

exports.main = async (event, context) => {
  const { studentId } = event

  if (!studentId) {
    return { success: false, message: '缺少学员ID' }
  }

  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)

    const studentRes = await db.collection('students').doc(studentId).get().catch(() => ({ data: null }))
    const student = studentRes.data
    if (!student) {
      return { success: false, message: '学员不存在' }
    }
    if (!isAdmin) {
      const scheduleAccess = await hasScheduleAccess(studentId, teacher._id)
      if (!hasTeacherAccess(student, teacher, openid) && !scheduleAccess) {
        return { success: false, message: '无权限删除其他老师的学员', code: 403 }
      }
      const teacherIds = Array.isArray(student.teacher_ids) ? student.teacher_ids.filter(Boolean) : []
      const sharedByField = teacherIds.some(id => id !== teacher._id)
      const sharedBySchedule = await hasOtherTeacherSchedules(studentId, teacher._id)
      if (sharedByField || sharedBySchedule) {
        return { success: false, message: '该学员关联其他老师，请联系管理员处理', code: 403 }
      }
      if (await hasStudentRows('orders', studentId)) {
        return { success: false, message: '该学员已有管理员关联记录，请联系管理员处理', code: 403 }
      }
    }

    const collections = ['course_balance', 'orders', 'attendance', 'feedbacks', 'leaves']
    for (const collectionName of collections) {
      await removeStudentRows(collectionName, 'student_id', studentId)
      await removeStudentRows(collectionName, 'studentId', studentId)
    }

    while (true) {
      const scheduleRes = await db.collection('schedules').where({
        student_ids: _.all([studentId])
      }).limit(100).get()
      if (scheduleRes.data.length === 0) break

      for (const schedule of scheduleRes.data) {
        const studentIds = Array.isArray(schedule.student_ids)
          ? schedule.student_ids.filter(id => id !== studentId)
          : []
        const data = {
          student_ids: studentIds,
          updated_at: db.serverDate()
        }
        if (studentIds.length === 0 && schedule.status === 'pending') {
          data.status = 'cancelled'
        }
        await db.collection('schedules').doc(schedule._id).update({ data })
      }
    }

    await db.collection('students').doc(studentId).remove()
    await createAuditLog({
      action: 'delete',
      teacher,
      openid,
      studentId,
      studentName: student.name || '',
      before: student
    })

    return { success: true, message: '学员已删除' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('删除学员失败', err)
    return { success: false, message: '删除失败: ' + err.message }
  }
}
