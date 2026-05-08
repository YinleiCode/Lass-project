// 首页数据聚合统计
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
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

    // 5. 今日课表详情
    const todayAllSchedules = await db.collection('schedules').where({
      start_time: _.gte(today + ' 00:00').and(_.lte(today + ' 23:59'))
    }).orderBy('start_time', 'asc').get()

    return {
      success: true,
      data: {
        todayPending: todaySchedules.total,
        monthAttendance: monthAttendance.total,
        monthIncome: monthIncome,
        warningCount: warningList.length,
        warningList: warningList,
        todaySchedules: todayAllSchedules.data
      }
    }
  } catch (err) {
    console.error('统计失败', err)
    return { success: false, message: err.message }
  }
}
