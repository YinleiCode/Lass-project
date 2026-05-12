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

// 给 schedule 单条/批量 enrich 学员名 / 课程包名 / 时间字符串
async function enrichSchedules(schedules) {
  if (!schedules.length) return schedules

  // 收集所有需要查的 student_ids / package_ids
  const studentIdSet = new Set()
  const packageIdSet = new Set()
  for (const s of schedules) {
    if (Array.isArray(s.student_ids)) s.student_ids.forEach(id => studentIdSet.add(id))
    if (s.package_id) packageIdSet.add(s.package_id)
  }

  // 批量查 students 和 packages
  const studentMap = {}
  const packageMap = {}

  if (studentIdSet.size > 0) {
    const stuRes = await db.collection('students')
      .where({ _id: _.in(Array.from(studentIdSet)) })
      .get()
    for (const s of stuRes.data) studentMap[s._id] = s.name || ''
  }

  if (packageIdSet.size > 0) {
    const pkgRes = await db.collection('course_packages')
      .where({ _id: _.in(Array.from(packageIdSet)) })
      .get()
    for (const p of pkgRes.data) packageMap[p._id] = p.name || ''
  }

  // enrich 每条 schedule
  for (const s of schedules) {
    const names = (Array.isArray(s.student_ids) ? s.student_ids : [])
      .map(id => studentMap[id])
      .filter(Boolean)
    s.student_names = names.join(' / ')
    s.package_name = packageMap[s.package_id] || ''
    // 时间字符串(HH:mm),便于 WXML 直接绑定
    if (s.start_time && typeof s.start_time === 'string' && s.start_time.length >= 16) {
      s.time_str = s.start_time.substring(11, 16)
    } else {
      s.time_str = ''
    }
    // 状态文案
    s.status_label = s.status === 'pending' ? '待上'
      : s.status === 'done' ? '已点名'
      : s.status === 'canceled' ? '已取消'
      : '待上'
  }
  return schedules
}

exports.main = async (event, context) => {
  try {
    await requireTeacher()

    // === 单条查询 ===
    if (event && event.scheduleId) {
      const docRes = await db.collection('schedules').doc(event.scheduleId).get()
      if (!docRes || !docRes.data) {
        return { success: false, message: '排课不存在', data: null }
      }
      const enriched = await enrichSchedules([docRes.data])
      return { success: true, data: enriched[0] }
    }

    // === 范围查询 ===
    if (event && event.startDate && event.endDate) {
      const startStr = event.startDate + ' 00:00'
      const endStr = event.endDate + ' 23:59'
      const res = await db.collection('schedules')
        .where({ start_time: _.gte(startStr).and(_.lte(endStr)) })
        .orderBy('start_time', 'asc')
        .get()
      const enriched = await enrichSchedules(res.data)
      return { success: true, data: enriched }
    }

    // === 默认:返回全部(谨慎使用) ===
    const res = await db.collection('schedules')
      .orderBy('start_time', 'desc')
      .limit(100)
      .get()
    const enriched = await enrichSchedules(res.data)
    return { success: true, data: enriched }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code, data: null }
    }
    console.error('读取排课失败', err)
    return { success: false, message: err.message, data: null }
  }
}
