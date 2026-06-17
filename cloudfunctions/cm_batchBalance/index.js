// 批量查询学员课时余额
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const IN_QUERY_LIMIT = 100
const DB_PAGE_LIMIT = 100
const REQUEST_STUDENT_LIMIT = 500

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

async function getAllowedStudentIds(studentIds, teacher, openid) {
  if (isAdminTeacher(teacher)) return Array.from(new Set((studentIds || []).filter(Boolean)))

  const requestedIds = Array.from(new Set((studentIds || []).filter(Boolean)))
  const allowed = new Set()
  const scheduleIds = await getScheduleStudentIds(teacher._id)

  for (let i = 0; i < requestedIds.length; i += IN_QUERY_LIMIT) {
    const res = await db.collection('students')
      .where({ _id: _.in(requestedIds.slice(i, i + IN_QUERY_LIMIT)) })
      .get()
    for (const student of res.data || []) {
      if (hasTeacherAccess(student, teacher, openid) || scheduleIds.has(student._id)) {
        allowed.add(student._id)
      }
    }
  }
  return Array.from(allowed)
}

function getStudentId(row) {
  return row.student_id || row.studentId || ''
}

function getPackageId(row) {
  return row.package_id || row.packageId || ''
}

function pushBalanceUnique(target, seen, rows) {
  for (const row of rows || []) {
    const key = row && row._id ? row._id : JSON.stringify(row)
    if (seen.has(key)) continue
    seen.add(key)
    target.push(row)
  }
}

async function getByStudentFields(collectionName, studentIds, fieldNames) {
  const ids = Array.from(new Set((studentIds || []).filter(Boolean)))
  const result = []
  const seen = new Set()

  for (let i = 0; i < ids.length; i += IN_QUERY_LIMIT) {
    const batchIds = ids.slice(i, i + IN_QUERY_LIMIT)
    for (const fieldName of fieldNames) {
      let skip = 0
      while (true) {
        const res = await db.collection(collectionName)
          .where({ [fieldName]: _.in(batchIds) })
          .skip(skip)
          .limit(DB_PAGE_LIMIT)
          .get()
        pushBalanceUnique(result, seen, res.data || [])
        if (!res.data || res.data.length < DB_PAGE_LIMIT) break
        skip += DB_PAGE_LIMIT
      }
    }
  }

  return result
}

exports.main = async (event, context) => {
  const { studentIds, includePackages } = event

  if (!Array.isArray(studentIds)) {
    return { success: false, message: '学员参数不合法', code: 400 }
  }

  const requestedStudentIds = Array.from(new Set(studentIds.filter(Boolean)))
  if (!requestedStudentIds.length) {
    return {
      success: true,
      data: includePackages ? { totals: {}, byPackage: {}, paidByPackage: {} } : {}
    }
  }
  if (requestedStudentIds.length > REQUEST_STUDENT_LIMIT) {
    return { success: false, message: `一次最多查询${REQUEST_STUDENT_LIMIT}名学员余额`, code: 400 }
  }

  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)
    const allowedStudentIds = await getAllowedStudentIds(requestedStudentIds, teacher, openid)
    if (allowedStudentIds.length === 0) {
      return {
        success: true,
        data: includePackages ? { totals: {}, byPackage: {}, paidByPackage: {} } : {}
      }
    }

    const balances = await getByStudentFields('course_balance', allowedStudentIds, ['student_id', 'studentId'])
    const orders = includePackages && isAdmin
      ? await getByStudentFields('orders', allowedStudentIds, ['student_id', 'studentId'])
      : []

    // 按 student_id 聚合余额
    const balanceMap = {}
    const byPackage = {}
    const paidByPackage = {}
    for (const b of balances) {
      const sid = getStudentId(b)
      if (!sid) continue
      if (!balanceMap[sid]) balanceMap[sid] = []
      balanceMap[sid].push(b)
      if (includePackages) {
        if (!byPackage[sid]) byPackage[sid] = {}
        const packageId = getPackageId(b)
        if (packageId) {
          byPackage[sid][packageId] = (byPackage[sid][packageId] || 0) + Number(b.remaining || 0)
        }
      }
    }

    if (includePackages && isAdmin) {
      for (const order of orders) {
        const sid = getStudentId(order)
        const packageId = getPackageId(order)
        if (!sid || !packageId) continue
        if (!paidByPackage[sid]) paidByPackage[sid] = {}
        paidByPackage[sid][packageId] = (paidByPackage[sid][packageId] || 0) + Number(order.course_count || 0)
      }
    }

    // 计算每个学员的 total remaining
    const result = {}
    for (const sid of allowedStudentIds) {
      const items = balanceMap[sid] || []
      result[sid] = items.reduce((sum, b) => sum + (b.remaining || 0), 0)
    }

    return {
      success: true,
      data: includePackages
        ? { totals: result, byPackage, paidByPackage: isAdmin ? paidByPackage : {} }
        : result
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('批量查余额失败', err)
    return { success: false, message: err.message }
  }
}
