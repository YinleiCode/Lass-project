// 老师端学员列表读取
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const IN_QUERY_LIMIT = 100
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

function pushUnique(target, seen, rows) {
  for (const row of rows || []) {
    if (!row || !row._id || seen.has(row._id)) continue
    seen.add(row._id)
    target.push(row)
  }
}

async function getAllStudents(where) {
  const all = []
  let skip = 0
  while (true) {
    let query = db.collection('students')
    if (where && Object.keys(where).length) query = query.where(where)
    const res = await query.orderBy('created_at', 'desc').skip(skip).limit(DB_PAGE_LIMIT).get()
    all.push(...(res.data || []))
    if (!res.data || res.data.length < DB_PAGE_LIMIT) break
    skip += DB_PAGE_LIMIT
  }
  return all
}

async function queryStudentsByIds(ids, extraWhere = {}) {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)))
  const result = []
  for (let i = 0; i < uniqueIds.length; i += IN_QUERY_LIMIT) {
    const batchIds = uniqueIds.slice(i, i + IN_QUERY_LIMIT)
    if (!batchIds.length) continue
    const rows = await getAllStudents({
      ...extraWhere,
      _id: _.in(batchIds)
    })
    result.push(...rows)
  }
  return result
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
      if (Array.isArray(schedule.student_ids)) {
        schedule.student_ids.forEach(id => ids.add(id))
      }
    }
    if (!res.data || res.data.length < DB_PAGE_LIMIT) break
    skip += DB_PAGE_LIMIT
  }
  return Array.from(ids)
}

function hasTeacherAccess(student, teacher, openid) {
  if (!student || !teacher) return false
  if (student.owner_teacher_id && student.owner_teacher_id === teacher._id) return true
  if (student.owner_teacher_openid && student.owner_teacher_openid === openid) return true
  if (Array.isArray(student.teacher_ids) && student.teacher_ids.includes(teacher._id)) return true
  return false
}

function isLegacyUnassigned(student) {
  return !student.owner_teacher_id && !student.owner_teacher_openid && !Array.isArray(student.teacher_ids)
}

async function enrichTeacherNames(students) {
  const teacherIds = new Set()
  for (const student of students) {
    if (student.owner_teacher_id) teacherIds.add(student.owner_teacher_id)
    if (Array.isArray(student.teacher_ids)) student.teacher_ids.forEach(id => teacherIds.add(id))
  }
  if (teacherIds.size === 0) return students

  const teachers = []
  const ids = Array.from(teacherIds)
  for (let i = 0; i < ids.length; i += IN_QUERY_LIMIT) {
    const res = await db.collection('teachers').where({ _id: _.in(ids.slice(i, i + IN_QUERY_LIMIT)) }).get()
    teachers.push(...(res.data || []))
  }
  const teacherMap = {}
  for (const teacher of teachers) teacherMap[teacher._id] = teacher.name || '老师'

  return students.map(student => {
    const teacherIds = Array.isArray(student.teacher_ids) ? student.teacher_ids : []
    return {
      ...student,
      owner_teacher_name: student.owner_teacher_name || teacherMap[student.owner_teacher_id] || '',
      access_teacher_names: teacherIds.map(id => teacherMap[id]).filter(Boolean)
    }
  })
}

exports.main = async (event) => {
  const filter = event && event.filter && typeof event.filter === 'object' ? event.filter : {}
  const safeFilter = {}

  if (filter.status) safeFilter.status = filter.status

  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)

    if (isAdmin) {
      const students = await enrichTeacherNames(await getAllStudents(safeFilter))
      return { success: true, data: students, isAdmin: true }
    }

    const students = []
    const seen = new Set()

    pushUnique(students, seen, await getAllStudents({ ...safeFilter, owner_teacher_id: teacher._id }))
    pushUnique(students, seen, await getAllStudents({ ...safeFilter, owner_teacher_openid: openid }))
    pushUnique(students, seen, await getAllStudents({ ...safeFilter, teacher_ids: _.all([teacher._id]) }))

    // 兼容老数据：没有归属字段，但已有该老师排课记录的学员，仍允许老师看到。
    const legacyIds = await getScheduleStudentIds(teacher._id)
    if (legacyIds.length) {
      const legacyStudents = await queryStudentsByIds(legacyIds, safeFilter)
      pushUnique(
        students,
        seen,
        legacyStudents.filter(student => hasTeacherAccess(student, teacher, openid) || isLegacyUnassigned(student))
      )
    }

    const enriched = await enrichTeacherNames(students)
    return { success: true, data: enriched, isAdmin: false }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('读取学员列表失败', err)
    return { success: false, message: err.message || '读取失败' }
  }
}
