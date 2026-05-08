// 创建缴费订单 + 更新课时余额
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { studentId, packageId, courseCount, amount, payDate, payMethod, remark } = event

  if (!studentId || !packageId || !courseCount || !amount) {
    return { success: false, message: '参数不完整' }
  }

  try {
    // 1. 创建订单记录
    const orderRes = await db.collection('orders').add({
      data: {
        student_id: studentId,
        package_id: packageId,
        course_count: courseCount,
        amount: amount,
        pay_date: payDate || new Date().toISOString().split('T')[0],
        pay_method: payMethod || '微信',
        remark: remark || '',
        created_at: db.serverDate()
      }
    })

    // 2. 更新课时余额（如存在则增加，不存在则创建）
    const balanceRes = await db.collection('course_balance').where({
      student_id: studentId,
      package_id: packageId
    }).get()

    if (balanceRes.data.length > 0) {
      await db.collection('course_balance').where({
        student_id: studentId,
        package_id: packageId
      }).update({
        data: {
          total_purchased: _.inc(courseCount),
          remaining: _.inc(courseCount),
          last_updated: db.serverDate()
        }
      })
    } else {
      await db.collection('course_balance').add({
        data: {
          student_id: studentId,
          package_id: packageId,
          total_purchased: courseCount,
          total_used: 0,
          remaining: courseCount,
          last_updated: db.serverDate()
        }
      })
    }

    return { success: true, message: '缴费已登记', orderId: orderRes._id }
  } catch (err) {
    console.error('缴费失败', err)
    return { success: false, message: '缴费失败: ' + err.message }
  }
}
