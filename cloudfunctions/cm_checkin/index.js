// 批量点名 - 原子操作
// 入参: { scheduleId, students: [{ id, status, deduct_count }] }
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { scheduleId, students } = event

  if (!scheduleId || !students || !students.length) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const { openid } = await requireTeacher()

    // 获取排课信息
    const scheduleRes = await db.collection('schedules').doc(scheduleId).get()
    const schedule = scheduleRes.data

    if (schedule.status === 'done') {
      return { success: false, message: '该课程已点名，请勿重复操作' }
    }

    // 批量处理每个学员
    const attendanceRecords = []
    const balanceUpdates = []
    const studentUpdates = []

    for (const stu of students) {
      // 写入考勤记录
      attendanceRecords.push({
        schedule_id: scheduleId,
        student_id: stu.id,
        status: stu.status, // present / absent / leave
        deduct_count: stu.deduct_count || (stu.status === 'present' ? 1 : 0),
        attended_at: db.serverDate(),
        operated_by: openid
      })

      // 只有需要扣课时的才更新余额
      const deduct = stu.deduct_count || (stu.status === 'present' ? 1 : 0)
      if (deduct > 0) {
        balanceUpdates.push({
          student_id: stu.id,
          package_id: schedule.package_id,
          deduct: deduct
        })
      }

      // 到课的更新累计次数
      if (stu.status === 'present') {
        studentUpdates.push(stu.id)
      }
    }

    // 1. 批量写入考勤
    for (const record of attendanceRecords) {
      await db.collection('attendance').add({ data: record })
    }

    // 2. 更新课时余额
    for (const bu of balanceUpdates) {
      await db.collection('course_balance').where({
        student_id: bu.student_id,
        package_id: bu.package_id
      }).update({
        data: {
          total_used: _.inc(bu.deduct),
          remaining: _.inc(-bu.deduct),
          last_updated: db.serverDate()
        }
      })
    }

    // 3. 更新学员累计上课次数
    for (const sid of studentUpdates) {
      await db.collection('students').doc(sid).update({
        data: {
          total_attended: _.inc(1),
          updated_at: db.serverDate()
        }
      })
    }

    // 4. 更新排课状态
    await db.collection('schedules').doc(scheduleId).update({
      data: {
        status: 'done',
        updated_at: db.serverDate()
      }
    })

    return { success: true, message: '点名成功' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('点名失败', err)
    return { success: false, message: '点名失败: ' + err.message }
  }
}
