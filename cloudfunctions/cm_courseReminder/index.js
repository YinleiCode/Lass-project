// 上课前提醒 - 定时触发器每小时执行
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const now = new Date()
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

    const nowStr = now.toISOString().replace('T', ' ').substring(0, 16)
    const laterStr = oneHourLater.toISOString().replace('T', ' ').substring(0, 16)

    // 查询未来1小时内的待上课程（且未发送提醒）
    const schedules = await db.collection('schedules').where({
      start_time: _.gte(nowStr).and(_.lte(laterStr)),
      status: 'pending',
      reminder_sent: false
    }).get()

    let sentCount = 0

    for (const schedule of schedules.data) {
      // 获取每个学员的家长openid
      for (const studentId of schedule.student_ids) {
        try {
          const stuRes = await db.collection('students').doc(studentId).get()
          const student = stuRes.data

          if (!student || !student.parent_openid) continue

          // 获取课程包名称
          let packageName = '课程'
          try {
            const pkgRes = await db.collection('course_packages').doc(schedule.package_id).get()
            packageName = pkgRes.data.name || '课程'
          } catch (e) {}

          // 发送订阅消息
          // 请在微信公众平台申请模板后替换下方的 templateId
          const TEMPLATE_ID = '' // TODO: 替换为你的订阅消息模板ID
          if (TEMPLATE_ID) {
            await cloud.openapi.subscribeMessage.send({
              touser: student.parent_openid,
              templateId: TEMPLATE_ID,
              page: 'pages/parent/home/home',
              data: {
                thing1: { value: student.name },
                time2: { value: schedule.start_time },
                thing3: { value: packageName }
              }
            })
          }
          sentCount++
        } catch (e) {
          // 单个学员发送失败不影响其他
          console.warn('提醒发送失败:', studentId, e.message)
        }
      }

      // 标记已发送
      await db.collection('schedules').doc(schedule._id).update({
        data: { reminder_sent: true }
      })
    }

    return {
      success: true,
      message: `已发送${sentCount}条提醒`,
      schedulesProcessed: schedules.data.length
    }
  } catch (err) {
    console.error('提醒任务失败', err)
    return { success: false, message: err.message }
  }
}
