// 上课前提醒 - 定时触发器每小时执行
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function chinaDateString(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const d = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

exports.main = async (event, context) => {
  try {
    // 定时触发器调用时 OPENID 为空, 跳过身份校验
    // 手动调用必须是老师
    const { OPENID } = cloud.getWXContext()
    if (OPENID) {
      await requireTeacher()
    }

    // 订阅消息必须先在微信公众平台申请模板，并配置环境变量 COURSE_REMINDER_TEMPLATE_ID
    const TEMPLATE_ID = process.env.COURSE_REMINDER_TEMPLATE_ID || ''
    if (!TEMPLATE_ID) {
      console.warn('cm_courseReminder: TEMPLATE_ID 未配置, 跳过本次提醒')
      return {
        success: true,
        message: '模板ID未配置, 跳过提醒',
        sent: 0,
        schedulesProcessed: 0
      }
    }

    const daysBefore = Number(event && event.daysBefore)
    const offsetDays = Number.isInteger(daysBefore) && daysBefore > 0 ? daysBefore : 1
    const targetDate = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
    const targetDateStr = chinaDateString(targetDate)
    const startStr = targetDateStr + ' 00:00'
    const endStr = targetDateStr + ' 23:59'

    // 查询上课前一天的待上课程（且未发送提醒）
    const schedules = await db.collection('schedules').where({
      start_time: _.gte(startStr).and(_.lte(endStr)),
      status: 'pending',
      reminder_sent: false
    }).get()

    let totalSent = 0

    for (const schedule of schedules.data) {
      let scheduleSentCount = 0

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

          const courseDesc = [
            packageName,
            schedule.class_display || schedule.class_type_label || '',
            schedule.delivery_mode_label || '',
            schedule.teacher_name ? `老师:${schedule.teacher_name}` : ''
          ].filter(Boolean).join(' ')

          // 发送订阅消息
          await cloud.openapi.subscribeMessage.send({
            touser: student.parent_openid,
            templateId: TEMPLATE_ID,
            page: 'pages/parent/home/home',
            data: {
              thing1: { value: student.name },
              time2: { value: schedule.start_time },
              thing3: { value: courseDesc.slice(0, 20) }
            }
          })
          scheduleSentCount++
        } catch (e) {
          // 单个学员发送失败不影响其他
          console.warn('提醒发送失败:', studentId, e.message)
        }
      }

      // 仅当本节课至少发送成功 1 条提醒时, 才标记 reminder_sent
      // 这样模板未配置或全部失败时, 下个小时还会重试
      if (scheduleSentCount > 0) {
        await db.collection('schedules').doc(schedule._id).update({
          data: { reminder_sent: true }
        })
      }
      totalSent += scheduleSentCount
    }

    return {
      success: true,
      message: `已发送${totalSent}条提醒`,
      sent: totalSent,
      targetDate: targetDateStr,
      schedulesProcessed: schedules.data.length
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('提醒任务失败', err)
    return { success: false, message: err.message }
  }
}
