// 创建排课（单次或周期性）
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

function getStudentId(row) {
  return row.student_id || row.studentId || ''
}

function getPackageId(row) {
  return row.package_id || row.packageId || ''
}

function pushUnique(target, seen, rows) {
  for (const row of rows || []) {
    const key = row && row._id ? row._id : JSON.stringify(row)
    if (seen.has(key)) continue
    seen.add(key)
    target.push(row)
  }
}

function formatDateTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

async function queryByStudentField(collectionName, studentIds, fieldName, extraWhere = {}) {
  const ids = Array.from(new Set((studentIds || []).filter(Boolean)))
  const result = []
  for (let i = 0; i < ids.length; i += IN_QUERY_LIMIT) {
    const batchIds = ids.slice(i, i + IN_QUERY_LIMIT)
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

async function queryByStudentIds(collectionName, studentIds, extraWhere = {}) {
  const result = []
  const seen = new Set()
  const rows = await queryByStudentField(collectionName, studentIds, 'student_id', extraWhere)
  pushUnique(result, seen, rows)

  const legacyRows = await queryByStudentField(collectionName, studentIds, 'studentId', extraWhere)
  pushUnique(result, seen, legacyRows)
  return result
}

function hasTeacherAccess(student, teacher, openid) {
  if (!student || !teacher) return false
  if (student.owner_teacher_id && student.owner_teacher_id === teacher._id) return true
  if (student.owner_teacher_openid && student.owner_teacher_openid === openid) return true
  if (Array.isArray(student.teacher_ids) && student.teacher_ids.includes(teacher._id)) return true
  return false
}

function isLegacyUnassigned(student) {
  return student && !student.owner_teacher_id && !student.owner_teacher_openid && !Array.isArray(student.teacher_ids)
}

async function hasExistingTeacherSchedule(studentId, teacherId) {
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

async function ensureStudentsVisibleToTeacher(studentIds, scheduleTeacher) {
  if (!scheduleTeacher || !scheduleTeacher._id) return
  for (const studentId of studentIds) {
    const studentRes = await db.collection('students').doc(studentId).get().catch(() => ({ data: null }))
    const student = studentRes.data
    if (!student) continue
    const teacherIds = Array.isArray(student.teacher_ids) ? student.teacher_ids.filter(Boolean) : []
    if (!teacherIds.includes(scheduleTeacher._id)) teacherIds.push(scheduleTeacher._id)
    const data = {
      teacher_ids: teacherIds,
      updated_at: db.serverDate()
    }
    if (!student.owner_teacher_id && !student.owner_teacher_openid) {
      data.owner_teacher_id = scheduleTeacher._id
      data.owner_teacher_openid = scheduleTeacher.openid || ''
      data.owner_teacher_name = scheduleTeacher.name || '老师'
    }
    await db.collection('students').doc(studentId).update({ data })
  }
}

exports.main = async (event, context) => {
  const {
    type,
    studentIds,
    packageId,
    startTime,
    endTime,
    classroom,
    recurringEnd,
    classType,
    deliveryMode,
    teacherId
  } = event

  if (!studentIds || !studentIds.length || !packageId || !startTime) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)

    if (!['once', 'recurring'].includes(type)) return { success: false, message: '未知排课类型' }
    if (!Array.isArray(studentIds) || studentIds.length === 0 || studentIds.length > 20) {
      return { success: false, message: '学员数量不合法' }
    }
    const finalClassType = classType || 'one_to_one'
    const finalDeliveryMode = deliveryMode || 'offline'
    if (!VALID_CLASS_TYPES[finalClassType]) return { success: false, message: '班型不合法' }
    if (!VALID_DELIVERY_MODES[finalDeliveryMode]) return { success: false, message: '上课方式不合法' }

    let scheduleTeacher = teacher
    if (isAdmin && teacherId) {
      const teacherRes = await db.collection('teachers').doc(teacherId).get()
      if (!teacherRes.data) return { success: false, message: '授课老师不存在' }
      scheduleTeacher = teacherRes.data
    } else if (!isAdmin && teacherId && teacherId !== teacher._id) {
      return { success: false, message: '老师只能给自己排课', code: 403 }
    }

    const start = new Date(String(startTime).replace(/-/g, '/'))
    if (Number.isNaN(start.getTime())) return { success: false, message: '开始时间不合法' }

    const pkgRes = await db.collection('course_packages').doc(packageId).get()
    if (!pkgRes.data) return { success: false, message: '课程包不存在' }
    const packageActive = pkgRes.data.is_active !== false

    const stuRes = await db.collection('students').where({ _id: _.in(studentIds), status: 'active' }).get()
    if (stuRes.data.length !== studentIds.length) return { success: false, message: '包含不存在或非在读学员' }
    if (!isAdmin) {
      const forbidden = []
      for (const student of stuRes.data) {
        const legacyAccess = isLegacyUnassigned(student) && await hasExistingTeacherSchedule(student._id, teacher._id)
        if (!hasTeacherAccess(student, teacher, openid) && !legacyAccess) forbidden.push(student)
      }
      if (forbidden.length > 0) {
        return { success: false, message: `不能给其他老师的学员排课：${forbidden.map(s => s.name || '学员').join('、')}`, code: 403 }
      }
    }

    const balanceRows = await queryByStudentIds('course_balance', studentIds)
    const packageBalanceMap = {}

    for (const b of balanceRows) {
      const sid = getStudentId(b)
      if (!sid) continue
      const remaining = Number(b.remaining || 0)
      const rowPackageId = getPackageId(b)
      if (rowPackageId === packageId) {
        packageBalanceMap[sid] = (packageBalanceMap[sid] || 0) + remaining
      }
    }

    const studentNameMap = {}
    for (const s of stuRes.data) studentNameMap[s._id] = s.name || '学员'
    const unavailable = studentIds.filter(id => {
      const packageRemaining = Number(packageBalanceMap[id] || 0)
      return packageRemaining <= 0
    }).map(id => studentNameMap[id])

    if (unavailable.length > 0) {
      return {
        success: false,
        message: isAdmin
          ? `${unavailable.join('、')} 暂无可用余课，请先登记缴费`
          : `${unavailable.join('、')} 暂无可用余课，请联系管理员补课时`
      }
    }

    if (type === 'once') {
      // 单次排课
      await db.collection('schedules').add({
        data: {
          student_ids: studentIds,
          package_id: packageId,
          class_type: finalClassType,
          class_type_label: VALID_CLASS_TYPES[finalClassType],
          delivery_mode: finalDeliveryMode,
          delivery_mode_label: VALID_DELIVERY_MODES[finalDeliveryMode],
          teacher_id: scheduleTeacher._id || '',
          teacher_name: scheduleTeacher.name || '授课老师',
          start_time: startTime,
          end_time: endTime || '',
          classroom: classroom || '',
          status: 'pending',
          is_recurring: false,
          recurring_id: '',
          reminder_sent: false,
          created_at: db.serverDate()
        }
      })
      await ensureStudentsVisibleToTeacher(studentIds, scheduleTeacher)
      return { success: true, message: '排课成功', count: 1 }
    }

    if (type === 'recurring') {
      if (!recurringEnd) return { success: false, message: '请选择周期课截止日期' }
      // 周期性排课：从startTime到recurringEnd，每周同一时间
      const recurringId = 'rec_' + Date.now()
      const end = new Date(String(recurringEnd).replace(/-/g, '/') + ' 23:59')
      if (Number.isNaN(end.getTime()) || end < start) return { success: false, message: '截止日期不合法' }

      let count = 0
      let current = new Date(start)

      while (current <= end && count < 52) {
        const startStr = formatDateTime(current)
        
        // 计算结束时间
        let endStr = ''
        if (endTime) {
          const duration = new Date(endTime) - new Date(startTime)
          const endDate = new Date(current.getTime() + duration)
          endStr = formatDateTime(endDate)
        }

        await db.collection('schedules').add({
          data: {
            student_ids: studentIds,
            package_id: packageId,
            class_type: finalClassType,
            class_type_label: VALID_CLASS_TYPES[finalClassType],
            delivery_mode: finalDeliveryMode,
            delivery_mode_label: VALID_DELIVERY_MODES[finalDeliveryMode],
            teacher_id: scheduleTeacher._id || '',
            teacher_name: scheduleTeacher.name || '授课老师',
            start_time: startStr,
            end_time: endStr,
            classroom: classroom || '',
            status: 'pending',
            is_recurring: true,
            recurring_id: recurringId,
            reminder_sent: false,
            created_at: db.serverDate()
          }
        })

        // 加7天
        current.setDate(current.getDate() + 7)
        count++
      }
      await ensureStudentsVisibleToTeacher(studentIds, scheduleTeacher)

      const truncated = current <= end
      return {
        success: true,
        message: truncated ? `已生成${count}节周期课，已达最多52节限制` : `已生成${count}节周期课`,
        count,
        truncated
      }
    }

    return { success: false, message: '未知排课类型' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('排课失败', err)
    return { success: false, message: '排课失败: ' + err.message }
  }
}
