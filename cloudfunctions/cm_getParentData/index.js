// 家长端数据读取 - 家长按 OPENID 限权；管理员测试模式允许指定 studentId
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const VALID_CLASS_TYPES = {
  one_to_one: '一对一',
  one_to_three: '一对三/小班课'
}
const VALID_DELIVERY_MODES = {
  offline: '线下课',
  online: '线上课'
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

async function getParentStudent(studentId) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw { code: 401, message: '未登录' }

  if (studentId) {
    const teacherRes = await db.collection('teachers')
      .where({ openid: OPENID })
      .limit(1)
      .get()

    if (teacherRes.data.length > 0 && isAdminTeacher(teacherRes.data[0])) {
      const stuRes = await db.collection('students').doc(studentId).get()
      if (!stuRes.data) throw { code: 404, message: '学员不存在' }
      return stuRes.data
    }
  }

  const query = { parent_openid: OPENID }
  if (studentId) query._id = studentId

  const res = await db.collection('students').where(query).limit(1).get()
  if (res.data.length === 0) throw { code: 403, message: '无权限访问该学员' }
  return res.data[0]
}

async function enrichSchedules(schedules) {
  if (!schedules.length) return schedules
  const packageIds = Array.from(new Set(schedules.map(s => s.package_id).filter(Boolean)))
  const teacherIds = Array.from(new Set(schedules.map(s => s.teacher_id).filter(Boolean)))
  const packageMap = {}
  const teacherMap = {}
  if (packageIds.length) {
    const pkgRes = await db.collection('course_packages').where({ _id: _.in(packageIds) }).get()
    for (const p of pkgRes.data) packageMap[p._id] = p
  }
  if (teacherIds.length) {
    const teacherRes = await db.collection('teachers').where({ _id: _.in(teacherIds) }).get()
    for (const t of teacherRes.data) teacherMap[t._id] = t.name || '授课老师'
  }

  return schedules.map(s => {
    const pkg = packageMap[s.package_id] || null
    const packageDuration = Number(pkg && pkg.duration_min)
    const durationMin = Number.isFinite(packageDuration) && packageDuration > 0 ? packageDuration : 0
    const studentCount = Array.isArray(s.student_ids) ? s.student_ids.length : 1
    const inferredClassType = studentCount > 1 ? 'one_to_three' : 'one_to_one'
    const classType = s.class_type || inferredClassType
    const deliveryMode = s.delivery_mode || 'offline'
    const classBaseLabel = s.class_type_label || VALID_CLASS_TYPES[classType] || '课程'
    return {
      ...s,
      package_name: pkg ? (pkg.name || '') : '',
      duration_min: durationMin,
      duration_text: durationMin ? `${durationMin}分钟` : '',
      class_type: classType,
      class_type_label: classBaseLabel,
      class_display: classType === 'one_to_three' ? `${Math.max(studentCount, 1)}人小课` : classBaseLabel,
      delivery_mode: deliveryMode,
      delivery_mode_label: s.delivery_mode_label || VALID_DELIVERY_MODES[deliveryMode] || '',
      teacher_name: s.teacher_name || teacherMap[s.teacher_id] || '授课老师',
      student_names: '',
      time_str: s.start_time && typeof s.start_time === 'string' ? s.start_time.substring(11, 16) : '',
      status_label: s.status === 'pending' ? '待上'
        : s.status === 'done' ? '已点名'
        : s.status === 'canceled' || s.status === 'cancelled' ? '已取消'
        : '待上'
    }
  })
}

async function getBalances(studentId) {
  const [res, legacyRes] = await Promise.all([
    db.collection('course_balance').where({ student_id: studentId }).get(),
    db.collection('course_balance').where({ studentId }).get()
  ])
  const rows = []
  const seen = new Set()
  for (const row of [...(res.data || []), ...(legacyRes.data || [])]) {
    const key = row && row._id ? row._id : JSON.stringify(row)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }
  const packageIds = Array.from(new Set(rows.map(b => b.package_id || b.packageId).filter(Boolean)))
  const packageMap = {}
  if (packageIds.length) {
    const pkgRes = await db.collection('course_packages').where({ _id: _.in(packageIds) }).get()
    for (const p of pkgRes.data) {
      packageMap[p._id] = p.name || ''
    }
  }
  return rows.map(b => {
    const remaining = Number(b.remaining || 0)
    const packageId = b.package_id || b.packageId || ''
    return {
      _id: b._id || '',
      student_id: b.student_id || b.studentId || '',
      package_id: packageId,
      package_name: packageMap[packageId] || '',
      total_purchased: Number(b.total_purchased || 0),
      total_used: Number(b.total_used || 0),
      remaining,
      last_updated: b.last_updated || null
    }
  })
}

function getChinaMinuteString() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const china = new Date(utc + 8 * 60 * 60000)
  const y = china.getFullYear()
  const m = String(china.getMonth() + 1).padStart(2, '0')
  const d = String(china.getDate()).padStart(2, '0')
  const hh = String(china.getHours()).padStart(2, '0')
  const mm = String(china.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

async function getFutureSchedules(studentId, limit = 20) {
  const nowMinute = getChinaMinuteString()
  const res = await db.collection('schedules')
    .where({
      student_ids: _.all([studentId]),
      start_time: _.gte(nowMinute),
      status: 'pending'
    })
    .orderBy('start_time', 'asc')
    .limit(limit)
    .get()
  return enrichSchedules(res.data)
}

async function getFeedbacks(studentId, limit = 20) {
  const res = await db.collection('feedbacks')
    .where({ student_id: studentId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get()
  if (!res.data.length) return []
  const scheduleIds = Array.from(new Set(res.data.map(f => f.schedule_id).filter(Boolean)))
  const scheduleMap = {}
  if (scheduleIds.length) {
    const scheduleRes = await db.collection('schedules').where({ _id: _.in(scheduleIds) }).get()
    const enriched = await enrichSchedules(scheduleRes.data)
    for (const s of enriched) scheduleMap[s._id] = s
  }
  return res.data.map(f => ({
    ...f,
    schedule: scheduleMap[f.schedule_id] || null,
    schedule_time: scheduleMap[f.schedule_id] ? scheduleMap[f.schedule_id].start_time : '',
    package_name: scheduleMap[f.schedule_id] ? scheduleMap[f.schedule_id].package_name : ''
  }))
}

async function getFeedbackDetail(studentId, scheduleId) {
  if (!scheduleId) throw { code: 400, message: '缺少课程ID' }

  const feedbackRes = await db.collection('feedbacks').where({
    student_id: studentId,
    schedule_id: scheduleId
  }).limit(1).get()

  let scheduleInfo = null
  try {
    const scheduleRes = await db.collection('schedules').doc(scheduleId).get()
    const schedule = scheduleRes.data
    if (schedule && Array.isArray(schedule.student_ids) && schedule.student_ids.includes(studentId)) {
      const enriched = await enrichSchedules([schedule])
      scheduleInfo = enriched[0]
    }
  } catch (e) {
    scheduleInfo = null
  }

  return {
    feedback: feedbackRes.data[0] || null,
    scheduleInfo
  }
}

exports.main = async (event) => {
  const action = event.action || 'home'

  try {
    const student = await getParentStudent(event.studentId)
    if (action === 'home') {
      const [balances, schedules, feedbacks] = await Promise.all([
        getBalances(student._id),
        getFutureSchedules(student._id, 3),
        getFeedbacks(student._id, 1)
      ])
      return {
        success: true,
        data: {
          student,
          balances,
          totalRemaining: balances.reduce((sum, b) => sum + (b.remaining || 0), 0),
          upcomingSchedules: schedules,
          latestFeedback: feedbacks[0] || null
        }
      }
    }

    if (action === 'profile') {
      return { success: true, data: { student } }
    }

    if (action === 'schedules') {
      const schedules = await getFutureSchedules(student._id, event.limit || 20)
      return { success: true, data: schedules }
    }

    if (action === 'feedbacks') {
      const feedbacks = await getFeedbacks(student._id, event.limit || 50)
      return { success: true, data: feedbacks }
    }

    if (action === 'feedbackDetail') {
      const data = await getFeedbackDetail(student._id, event.scheduleId)
      return { success: true, data }
    }

    if (action === 'orders') {
      return { success: false, message: '当前账号不能查看此页面', code: 403 }
    }

    return { success: false, message: '未知操作', code: 400 }
  } catch (err) {
    if (err && (err.code === 401 || err.code === 403 || err.code === 400 || err.code === 404)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('读取家长端数据失败', err)
    return { success: false, message: '读取失败' }
  }
}
