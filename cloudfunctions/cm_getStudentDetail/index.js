// 老师端学员详情聚合读取
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

function hasTeacherAccess(student, teacher, openid) {
  if (!student || !teacher) return false
  if (student.owner_teacher_id && student.owner_teacher_id === teacher._id) return true
  if (student.owner_teacher_openid && student.owner_teacher_openid === openid) return true
  if (Array.isArray(student.teacher_ids) && student.teacher_ids.includes(teacher._id)) return true
  return false
}

async function hasScheduleAccess(studentId, teacherId) {
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

async function enrichTeacherInfo(student) {
  const teacherIds = new Set()
  if (student.owner_teacher_id) teacherIds.add(student.owner_teacher_id)
  if (Array.isArray(student.teacher_ids)) student.teacher_ids.forEach(id => teacherIds.add(id))
  if (teacherIds.size === 0) return student

  const res = await db.collection('teachers')
    .where({ _id: _.in(Array.from(teacherIds).slice(0, 100)) })
    .get()
  const teacherMap = {}
  for (const teacher of res.data || []) teacherMap[teacher._id] = teacher.name || '老师'
  return {
    ...student,
    owner_teacher_name: student.owner_teacher_name || teacherMap[student.owner_teacher_id] || '',
    access_teacher_names: (Array.isArray(student.teacher_ids) ? student.teacher_ids : [])
      .map(id => teacherMap[id])
      .filter(Boolean)
  }
}

async function getVisibleFeedbacks(studentId, teacher, isAdmin, limit) {
  if (isAdmin) {
    const res = await db.collection('feedbacks')
      .where({ student_id: studentId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get()
    return res.data || []
  }

  const scheduleRes = await db.collection('schedules')
    .where({
      teacher_id: teacher._id,
      student_ids: _.all([studentId])
    })
    .limit(100)
    .get()
  const scheduleIds = new Set((scheduleRes.data || []).map(s => s._id).filter(Boolean))

  const feedbacks = []
  const res = await db.collection('feedbacks')
    .where({ student_id: studentId })
    .orderBy('created_at', 'desc')
    .limit(100)
    .get()
  for (const feedback of res.data || []) {
    if (feedback.teacher_id && feedback.teacher_id === teacher._id) {
      feedbacks.push(feedback)
    } else if (!feedback.teacher_id && scheduleIds.has(feedback.schedule_id)) {
      feedbacks.push(feedback)
    }
    if (feedbacks.length >= limit) break
  }
  return feedbacks
}

async function enrichBalancePackages(balances) {
  const packageIds = Array.from(new Set((balances || []).map(b => b.package_id || b.packageId).filter(Boolean)))
  if (!packageIds.length) return balances || []

  const res = await db.collection('course_packages')
    .where({ _id: _.in(packageIds.slice(0, 100)) })
    .get()
  const packageMap = {}
  for (const pkg of res.data || []) packageMap[pkg._id] = pkg.name || '课程包'

  return (balances || []).map(b => ({
    ...b,
    package_name: b.package_name || packageMap[b.package_id || b.packageId] || '课程包'
  }))
}

function sanitizeBalanceForTeacher(balance) {
  return {
    _id: balance._id || '',
    student_id: balance.student_id || balance.studentId || '',
    package_id: balance.package_id || balance.packageId || '',
    package_name: balance.package_name || '课程包',
    total_purchased: Number(balance.total_purchased || 0),
    total_used: Number(balance.total_used || 0),
    remaining: Number(balance.remaining || 0),
    last_updated: balance.last_updated || null
  }
}

function mergeRows(primaryRows, legacyRows) {
  const rows = []
  const seen = new Set()
  for (const row of [...(primaryRows || []), ...(legacyRows || [])]) {
    const key = row && row._id ? row._id : JSON.stringify(row)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }
  return rows
}

exports.main = async (event = {}) => {
  const { studentId } = event
  const feedbackLimit = Math.min(Number(event.feedbackLimit || 10) || 10, 100)
  if (!studentId) return { success: false, message: '缺少学员ID' }

  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)

    const studentRes = await db.collection('students').doc(studentId).get()
    let student = studentRes.data
    if (!student) return { success: false, message: '学员不存在' }

    if (!isAdmin) {
      const scheduleAccess = await hasScheduleAccess(studentId, teacher._id)
      if (!hasTeacherAccess(student, teacher, openid) && !scheduleAccess) {
        return { success: false, message: '无权限访问其他老师的学员', code: 403 }
      }
    }
    student = await enrichTeacherInfo(student)

    const [balancesRes, legacyBalancesRes, ordersRes, feedbacks] = await Promise.all([
      db.collection('course_balance').where({ student_id: studentId }).get(),
      db.collection('course_balance').where({ studentId }).get(),
      isAdmin
        ? db.collection('orders').where({ student_id: studentId }).orderBy('created_at', 'desc').get()
        : Promise.resolve({ data: [] }),
      getVisibleFeedbacks(studentId, teacher, isAdmin, feedbackLimit)
    ])

    const balanceRows = mergeRows(balancesRes.data || [], legacyBalancesRes.data || [])
    const balances = isAdmin
      ? balanceRows
      : (await enrichBalancePackages(balanceRows)).map(sanitizeBalanceForTeacher)

    return {
      success: true,
      data: {
        student,
        balances,
        orders: ordersRes.data || [],
        feedbacks,
        isAdmin
      }
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('读取学员详情失败', err)
    return { success: false, message: err.message || '读取失败' }
  }
}
