// 撤销点名 - 回滚所有操作
// 入参: { scheduleId }
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { scheduleId } = event

  if (!scheduleId) {
    return { success: false, message: '缺少排课ID' }
  }

  try {
    await requireTeacher()

    // 获取排课信息
    const scheduleRes = await db.collection('schedules').doc(scheduleId).get()
    const schedule = scheduleRes.data

    if (schedule.status !== 'done') {
      return { success: false, message: '该课程未点名，无需撤销' }
    }

    // 检查是否在24小时内
    const checkedTime = schedule.updated_at || schedule.created_at
    const now = new Date()
    const diffHours = (now - new Date(checkedTime)) / (1000 * 60 * 60)
    if (diffHours > 24) {
      return { success: false, message: '已超过24小时，无法撤销' }
    }

    // 查询本次考勤记录
    const attRes = await db.collection('attendance').where({
      schedule_id: scheduleId
    }).get()
    const attendances = attRes.data

    // 1. 回滚课时余额
    for (const att of attendances) {
      if (att.deduct_count > 0) {
        await db.collection('course_balance').where({
          student_id: att.student_id,
          package_id: schedule.package_id
        }).update({
          data: {
            total_used: _.inc(-att.deduct_count),
            remaining: _.inc(att.deduct_count),
            last_updated: db.serverDate()
          }
        })
      }

      // 回滚累计上课次数
      if (att.status === 'present') {
        await db.collection('students').doc(att.student_id).update({
          data: {
            total_attended: _.inc(-1),
            updated_at: db.serverDate()
          }
        })
      }
    }

    // 2. 删除考勤记录
    for (const att of attendances) {
      await db.collection('attendance').doc(att._id).remove()
    }

    // 3. 删除反馈记录（如有）
    await db.collection('feedbacks').where({
      schedule_id: scheduleId
    }).remove()

    // 4. 恢复排课状态
    await db.collection('schedules').doc(scheduleId).update({
      data: {
        status: 'pending',
        updated_at: db.serverDate()
      }
    })

    return { success: true, message: '撤销成功，课时已恢复' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('撤销失败', err)
    return { success: false, message: '撤销失败: ' + err.message }
  }
}
