// 首页数据聚合统计
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    await requireTeacher()

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const monthStart = today.substring(0, 7) + '-01'

    // 1. 今日待上课数
    const todaySchedules = await db.collection('schedules').where({
      start_time: _.gte(today + ' 00:00').and(_.lte(today + ' 23:59')),
      status: 'pending'
    }).count()

    // 2. 本月已完成课消
    const monthAttendance = await db.collection('attendance').where({
      attended_at: _.gte(new Date(monthStart))
    }).count()

    // 3. 本月收入
    const monthOrders = await db.collection('orders').where({
      pay_date: _.gte(monthStart)
    }).get()
    const monthIncome = monthOrders.data.reduce((sum, o) => sum + (o.amount || 0), 0)

    // 4. 课时预警学员(剩余≤3)
    const warningStudents = await db.collection('course_balance').where({
      remaining: _.lte(3)
    }).get()

    // 获取预警学员姓名
    const warningList = []
    for (const b of warningStudents.data) {
      const stuRes = await db.collection('students').doc(b.student_id).get()
      if (stuRes.data) {
        warningList.push({
          _id: b.student_id,
          name: stuRes.data.name,
          remaining: b.remaining
        })
      }
    }

    // 5. 今日课表详情 — enrich 学员名/课程包名/时间字符串
    const todayAllSchedules = await db.collection('schedules').where({
      start_time: _.gte(today + ' 00:00').and(_.lte(today + ' 23:59'))
    }).orderBy('start_time', 'asc').get()

    const rawList = todayAllSchedules.data || []

    // 批量查 students / packages 减少 N+1
    const studentIdSet = new Set()
    const packageIdSet = new Set()
    for (const s of rawList) {
      if (Array.isArray(s.student_ids)) s.student_ids.forEach(id => studentIdSet.add(id))
      if (s.package_id) packageIdSet.add(s.package_id)
    }
    const studentMap = {}
    const packageMap = {}
    if (studentIdSet.size > 0) {
      const r = await db.collection('students').where({ _id: _.in(Array.from(studentIdSet)) }).get()
      for (const x of r.data) studentMap[x._id] = x.name || ''
    }
    if (packageIdSet.size > 0) {
      const r = await db.collection('course_packages').where({ _id: _.in(Array.from(packageIdSet)) }).get()
      for (const x of r.data) packageMap[x._id] = x.name || ''
    }
    for (const s of rawList) {
      const names = (Array.isArray(s.student_ids) ? s.student_ids : [])
        .map(id => studentMap[id])
        .filter(Boolean)
      s.student_names = names.join(' / ') || '未指定学员'
      s.package_name = packageMap[s.package_id] || ''
      s.time_str = (s.start_time && s.start_time.length >= 16) ? s.start_time.substring(11, 16) : ''
    }

    // 预先格式化金额(WXML 不支持函数调用,前端没法 format.money)
    const monthIncome_str = '¥' + Number(monthIncome || 0).toLocaleString()

    return {
      success: true,
      data: {
        todayPending: todaySchedules.total,
        monthAttendance: monthAttendance.total,
        monthIncome: monthIncome,
        monthIncome_str: monthIncome_str,
        warningCount: warningList.length,
        warningList: warningList,
        todaySchedules: rawList
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
