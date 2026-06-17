// 读取排课 + 自动 enrich(学员名/课程包名/时间字符串)
// event 支持两种形态:
//   { scheduleId: 'xxx' }                → 返回 { success, data: schedule(单条 enriched) }
//   { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' } → 返回 { success, data: [schedules...] }
// 任何场景失败都返回 { success: false, message, data: null/[] }
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const IN_QUERY_LIMIT = 100
const DB_PAGE_LIMIT = 100
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

function hasTeacherAccess(student, teacher, openid) {
  if (!student || !teacher) return false
  if (student.owner_teacher_id && student.owner_teacher_id === teacher._id) return true
  if (student.owner_teacher_openid && student.owner_teacher_openid === openid) return true
  if (Array.isArray(student.teacher_ids) && student.teacher_ids.includes(teacher._id)) return true
  return false
}

async function hasScheduleAccess(schedule, teacher, openid) {
  if (!schedule || !teacher) return false
  if (schedule.teacher_id) return schedule.teacher_id === teacher._id

  const studentIds = Array.isArray(schedule.student_ids)
    ? Array.from(new Set(schedule.student_ids.filter(Boolean)))
    : []
  if (!studentIds.length) return false

  const students = await queryByIds('students', '_id', studentIds)
  if (students.length !== studentIds.length) return false
  return students.every(student => hasTeacherAccess(student, teacher, openid))
}

function calcDurationMin(schedule, pkg) {
  const packageDuration = Number(pkg && pkg.duration_min)
  if (Number.isFinite(packageDuration) && packageDuration > 0) return packageDuration
  if (!schedule.start_time || !schedule.end_time) return 0
  const start = new Date(String(schedule.start_time).replace(/-/g, '/'))
  const end = new Date(String(schedule.end_time).replace(/-/g, '/'))
  const diff = Math.round((end - start) / 60000)
  return Number.isFinite(diff) && diff > 0 ? diff : 0
}

async function getAllByQuery(collectionName, query, order = null, limit = DB_PAGE_LIMIT) {
  const all = []
  let skip = 0
  while (true) {
    let q = db.collection(collectionName).where(query)
    if (order) q = q.orderBy(order.field, order.direction)
    const res = await q.skip(skip).limit(limit).get()
    all.push(...(res.data || []))
    if (!res.data || res.data.length < limit) break
    skip += limit
  }
  return all
}

async function queryByIds(collectionName, fieldName, ids, extraWhere = {}) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  const result = []
  for (let i = 0; i < uniqueIds.length; i += IN_QUERY_LIMIT) {
    const batchIds = uniqueIds.slice(i, i + IN_QUERY_LIMIT)
    if (!batchIds.length) continue

    let skip = 0
    while (true) {
      const res = await db.collection(collectionName)
        .where({
          ...extraWhere,
          [fieldName]: _.in(batchIds)
        })
        .skip(skip)
        .limit(DB_PAGE_LIMIT)
        .get()

      result.push(...res.data)
      if (res.data.length < DB_PAGE_LIMIT) break
      skip += DB_PAGE_LIMIT
    }
  }
  return result
}

// 给 schedule 单条/批量 enrich 学员名 / 课程包名 / 时间字符串
async function enrichSchedules(schedules) {
  if (!schedules.length) return schedules

  // 收集所有需要查的 student_ids / package_ids
  const studentIdSet = new Set()
  const packageIdSet = new Set()
  const teacherIdSet = new Set()
  for (const s of schedules) {
    if (Array.isArray(s.student_ids)) s.student_ids.forEach(id => studentIdSet.add(id))
    if (s.package_id) packageIdSet.add(s.package_id)
    if (s.teacher_id) teacherIdSet.add(s.teacher_id)
  }

  // 批量查 students 和 packages
  const studentMap = {}
  const packageMap = {}
  const teacherMap = {}

  if (studentIdSet.size > 0) {
    const students = await queryByIds('students', '_id', Array.from(studentIdSet))
    for (const s of students) studentMap[s._id] = s.name || ''
  }

  if (packageIdSet.size > 0) {
    const packages = await queryByIds('course_packages', '_id', Array.from(packageIdSet))
    for (const p of packages) packageMap[p._id] = p
  }

  if (teacherIdSet.size > 0) {
    const teachers = await queryByIds('teachers', '_id', Array.from(teacherIdSet))
    for (const t of teachers) teacherMap[t._id] = t.name || '授课老师'
  }

  const scheduleIds = schedules.map(s => s._id).filter(Boolean)
  const leaveMap = {}
  if (scheduleIds.length > 0) {
    const leaves = await queryByIds('leaves', 'schedule_id', scheduleIds, {
      status: _.neq('cancelled')
    })
    for (const l of leaves) {
      if (!leaveMap[l.schedule_id]) leaveMap[l.schedule_id] = []
      leaveMap[l.schedule_id].push(l)
    }
  }

  // enrich 每条 schedule
  for (const s of schedules) {
    const names = (Array.isArray(s.student_ids) ? s.student_ids : [])
      .map(id => studentMap[id])
      .filter(Boolean)
    const pkg = packageMap[s.package_id] || null
    const inferredClassType = names.length > 1 ? 'one_to_three' : 'one_to_one'
    const classType = s.class_type || inferredClassType
    const deliveryMode = s.delivery_mode || 'offline'
    const durationMin = calcDurationMin(s, pkg)
    const classBaseLabel = s.class_type_label || VALID_CLASS_TYPES[classType] || '课程'
    const classDisplay = classType === 'one_to_three'
      ? `${Math.max(names.length, 1)}人小课`
      : classBaseLabel
    s.student_names = names.join(' / ')
    s.student_count = names.length
    s.package_name = pkg ? (pkg.name || '') : ''
    s.duration_min = durationMin
    s.duration_text = durationMin ? `${durationMin}分钟` : ''
    s.class_type = classType
    s.class_type_label = classBaseLabel
    s.class_display = classDisplay
    s.delivery_mode = deliveryMode
    s.delivery_mode_label = s.delivery_mode_label || VALID_DELIVERY_MODES[deliveryMode] || ''
    s.teacher_name = s.teacher_name || teacherMap[s.teacher_id] || '授课老师'
    // 时间字符串(HH:mm),便于 WXML 直接绑定
    if (s.start_time && typeof s.start_time === 'string' && s.start_time.length >= 16) {
      s.time_str = s.start_time.substring(11, 16)
    } else {
      s.time_str = ''
    }
    // 状态文案
    s.status_label = s.status === 'pending' ? '待上'
      : s.status === 'done' ? '已点名'
      : s.status === 'cancelled' ? '已取消'
      : '待上'
    const leaves = leaveMap[s._id] || []
    s.leaves = leaves
    s.leave_student_ids = leaves.map(l => l.student_id).filter(Boolean)
    s.leave_count = s.leave_student_ids.length
    s.has_leave = s.leave_count > 0
    if (s.status === 'pending' && s.has_leave) {
      s.status_label = `请假${s.leave_count}人`
    }
  }
  return schedules
}

exports.main = async (event, context) => {
  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)

    // === 单条查询 ===
    if (event && event.scheduleId) {
      const docRes = await db.collection('schedules').doc(event.scheduleId).get()
      if (!docRes || !docRes.data) {
        return { success: false, message: '排课不存在', data: null }
      }
      if (!isAdmin && !await hasScheduleAccess(docRes.data, teacher, openid)) {
        return { success: false, message: '无权限访问该排课', code: 403, data: null }
      }
      const enriched = await enrichSchedules([docRes.data])
      return { success: true, data: enriched[0] }
    }

    // === 范围查询 ===
    if (event && event.startDate && event.endDate) {
      const startStr = event.startDate + ' 00:00'
      const endStr = event.endDate + ' 23:59'
      const where = {
        start_time: _.gte(startStr).and(_.lte(endStr))
      }
      if (!isAdmin) where.teacher_id = teacher._id
      const schedules = await getAllByQuery('schedules', where, { field: 'start_time', direction: 'asc' })
      const enriched = await enrichSchedules(schedules)
      return { success: true, data: enriched }
    }

    // === 默认:返回全部(谨慎使用) ===
    const where = {}
    if (!isAdmin) where.teacher_id = teacher._id
    const schedules = await getAllByQuery('schedules', where, { field: 'start_time', direction: 'desc' }, 100)
    const enriched = await enrichSchedules(schedules.slice(0, 100))
    return { success: true, data: enriched }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code, data: null }
    }
    console.error('读取排课失败', err)
    return { success: false, message: err.message, data: null }
  }
}
