// 删除学员及相关数据
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { studentId } = event

  if (!studentId) {
    return { success: false, message: '缺少学员ID' }
  }

  try {
    // 删除学员记录
    await db.collection('students').doc(studentId).remove()

    // 删除课时余额
    const balances = await db.collection('course_balance').where({ student_id: studentId }).get()
    for (const b of balances.data) {
      await db.collection('course_balance').doc(b._id).remove()
    }

    // 删除缴费订单
    const orders = await db.collection('orders').where({ student_id: studentId }).get()
    for (const o of orders.data) {
      await db.collection('orders').doc(o._id).remove()
    }

    // 删除考勤记录
    const attendances = await db.collection('attendance').where({ student_id: studentId }).get()
    for (const a of attendances.data) {
      await db.collection('attendance').doc(a._id).remove()
    }

    // 删除反馈
    const feedbacks = await db.collection('feedbacks').where({ student_id: studentId }).get()
    for (const f of feedbacks.data) {
      await db.collection('feedbacks').doc(f._id).remove()
    }

    // 删除请假记录
    const leaves = await db.collection('leaves').where({ student_id: studentId }).get()
    for (const l of leaves.data) {
      await db.collection('leaves').doc(l._id).remove()
    }

    return { success: true, message: '学员已删除' }
  } catch (err) {
    console.error('删除学员失败', err)
    return { success: false, message: '删除失败: ' + err.message }
  }
}
