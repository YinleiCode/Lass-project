// 首页数据聚合统计
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

function chinaDateString(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const d = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

async function getAll(collection, query = {}, order = null, limit = DB_PAGE_LIMIT) {
  let all = []
  let skip = 0
  while (true) {
    let q = db.collection(collection).where(query)
    if (order) q = q.orderBy(order.field, order.direction)
    const res = await q.skip(skip).limit(limit).get()
    all = all.concat(res.data || [])
    if (!res.data || res.data.length < limit) break
    skip += limit
  }
  return all
}

async function queryByIds(collectionName, fieldName, ids, extraWhere = {}) {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)))
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
      result.push(...(res.data || []))
      if (!res.data || res.data.length < DB_PAGE_LIMIT) break
      skip += DB_PAGE_LIMIT
    }
  }
  return result
}

function hasTeacherAccess(student, teacher, openid) {
  if (!student || !teacher) return false
  if (student.owner_teacher_id && student.owner_teacher_id === teacher._id) return true
  if (student.owner_teacher_openid && student.owner_teacher_openid === openid) return true
  if (Array.isArray(student.teacher_ids) && student.teacher_ids.includes(teacher._id)) return true
  return false
}

async function getScheduleStudentIds(teacherId) {
  const ids = new Set()
  let skip = 0
  while (true) {
    const res = await db.collection('schedules')
      .where({ teacher_id: teacherId })
      .skip(skip)
      .limit(DB_PAGE_LIMIT)
      .get()
    for (const schedule of res.data || []) {
      if (Array.isArray(schedule.student_ids)) schedule.student_ids.forEach(id => ids.add(id))
    }
    if (!res.data || res.data.length < DB_PAGE_LIMIT) break
    skip += DB_PAGE_LIMIT
  }
  return ids
}

async function enrichTodaySchedules(rawList) {
  const studentIdSet = new Set()
  const packageIdSet = new Set()
  const teacherIdSet = new Set()
  for (const s of rawList) {
    if (Array.isArray(s.student_ids)) s.student_ids.forEach(id => studentIdSet.add(id))
    if (s.package_id) packageIdSet.add(s.package_id)
    if (s.teacher_id) teacherIdSet.add(s.teacher_id)
  }

  const studentMap = {}
  const packageMap = {}
  const teacherMap = {}

  if (studentIdSet.size > 0) {
    const students = await queryByIds('students', '_id', Array.from(studentIdSet))
    for (const x of students) studentMap[x._id] = x.name || ''
  }
  if (packageIdSet.size > 0) {
    const packages = await queryByIds('course_packages', '_id', Array.from(packageIdSet))
    for (const x of packages) packageMap[x._id] = x
  }
  if (teacherIdSet.size > 0) {
    const teachers = await queryByIds('teachers', '_id', Array.from(teacherIdSet))
    for (const x of teachers) teacherMap[x._id] = x.name || '授课老师'
  }

  const scheduleIds = rawList.map(s => s._id).filter(Boolean)
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

  for (const s of rawList) {
    const names = (Array.isArray(s.student_ids) ? s.student_ids : [])
      .map(id => studentMap[id])
      .filter(Boolean)
    const pkg = packageMap[s.package_id] || null
    const inferredClassType = names.length > 1 ? 'one_to_three' : 'one_to_one'
    const classType = s.class_type || inferredClassType
    const deliveryMode = s.delivery_mode || 'offline'
    const durationMin = calcDurationMin(s, pkg)
    const classBaseLabel = s.class_type_label || VALID_CLASS_TYPES[classType] || '课程'
    s.student_names = names.join(' / ') || '未指定学员'
    s.student_count = names.length
    s.package_name = pkg ? (pkg.name || '') : ''
    s.duration_min = durationMin
    s.duration_text = durationMin ? `${durationMin}分钟` : ''
    s.class_type = classType
    s.class_type_label = classBaseLabel
    s.class_display = classType === 'one_to_three' ? `${Math.max(names.length, 1)}人小课` : classBaseLabel
    s.delivery_mode = deliveryMode
    s.delivery_mode_label = s.delivery_mode_label || VALID_DELIVERY_MODES[deliveryMode] || ''
    s.teacher_name = s.teacher_name || teacherMap[s.teacher_id] || '授课老师'
    s.time_str = (s.start_time && s.start_time.length >= 16) ? s.start_time.substring(11, 16) : ''
    const leaves = leaveMap[s._id] || []
    s.leaves = leaves
    s.leave_student_ids = leaves.map(l => l.student_id).filter(Boolean)
    s.leave_count = s.leave_student_ids.length
    s.has_leave = s.leave_count > 0
    s.leave_label = s.has_leave ? `请假 ${s.leave_count} 人` : ''
  }
  return rawList
}

exports.main = async (event, context) => {
  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)

    const today = chinaDateString(new Date())
    const monthStart = today.substring(0, 7) + '-01'

    const todayWhere = {
      start_time: _.gte(today + ' 00:00').and(_.lte(today + ' 23:59'))
    }
    if (!isAdmin) todayWhere.teacher_id = teacher._id

    // 1. 今日课表详情
    const rawList = await getAll('schedules', todayWhere, { field: 'start_time', direction: 'asc' })
    const todayScheduleList = await enrichTodaySchedules(rawList)
    const todayPending = todayScheduleList.filter(s => s.status === 'pending').length
    const todayTotalMinutes = todayScheduleList.reduce((sum, s) => sum + Number(s.duration_min || 0), 0)

    // 2. 本月已完成课消
    let monthAttendanceTotal = 0
    if (isAdmin) {
      const monthAttendance = await db.collection('attendance').where({
        attended_at: _.gte(new Date(String(monthStart).replace(/-/g, '/')))
      }).count()
      monthAttendanceTotal = monthAttendance.total || 0
    } else {
      const monthSchedules = await getAll('schedules', {
        start_time: _.gte(monthStart + ' 00:00').and(_.lte(today + ' 23:59')),
        teacher_id: teacher._id
      })
      const scheduleIds = monthSchedules.map(s => s._id).filter(Boolean)
      if (scheduleIds.length) {
        const attendanceRows = await queryByIds('attendance', 'schedule_id', scheduleIds)
        monthAttendanceTotal = attendanceRows.length
      }
    }

    // 3. 本月收入
    let monthIncome = 0
    if (isAdmin) {
      const monthOrders = await getAll('orders', {
        pay_date: _.gte(monthStart)
      })
      monthIncome = monthOrders.reduce((sum, o) => sum + (o.amount || 0), 0)
    }

    // 4. 课时预警学员(剩余≤3)
    let warningBalances = await getAll('course_balance', {
      remaining: _.lte(3)
    })

    // 获取预警学员姓名
    const warningList = []
    const warningStudentIds = Array.from(new Set(warningBalances.map(b => b.student_id).filter(Boolean)))
    const warningStudentMap = {}
    if (warningStudentIds.length > 0) {
      const warningStudents = await queryByIds('students', '_id', warningStudentIds)
      for (const stu of warningStudents) warningStudentMap[stu._id] = stu
    }
    let allowedWarningIds = null
    if (!isAdmin) {
      allowedWarningIds = new Set()
      const scheduleStudentIds = await getScheduleStudentIds(teacher._id)
      for (const studentId of warningStudentIds) {
        const student = warningStudentMap[studentId]
        if (hasTeacherAccess(student, teacher, openid) || scheduleStudentIds.has(studentId)) {
          allowedWarningIds.add(studentId)
        }
      }
      warningBalances = warningBalances.filter(b => allowedWarningIds.has(b.student_id))
    }
    for (const b of warningBalances) {
      const student = warningStudentMap[b.student_id]
      if (student) {
        warningList.push({
          _id: b.student_id,
          name: student.name,
          remaining: b.remaining
        })
      }
    }

    // 收入字段只返回给校长/管理员，普通老师端只拿课程统计。
    const adminMoneyFields = isAdmin
      ? {
        monthIncome,
        monthIncome_str: '¥' + Number(monthIncome || 0).toLocaleString()
      }
      : {}

    return {
      success: true,
      data: {
        ...adminMoneyFields,
        todayPending,
        todayLessonCount: todayScheduleList.length,
        todayTotalMinutes,
        todayTotalMinutesText: `${todayTotalMinutes}分钟`,
        monthAttendance: monthAttendanceTotal,
        isAdmin,
        warningCount: warningList.length,
        warningList: warningList,
        todaySchedules: todayScheduleList
      }
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('统计失败', err)
    return { success: false, message: err.message }
  }
}
