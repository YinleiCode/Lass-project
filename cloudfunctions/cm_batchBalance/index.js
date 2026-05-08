// 批量查询学员课时余额
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { studentIds } = event

  if (!studentIds || !studentIds.length) {
    return { success: true, data: {} }
  }

  try {
    const res = await db.collection('course_balance').where({
      student_id: _.in(studentIds)
    }).get()

    // 按 student_id 聚合余额
    const balanceMap = {}
    for (const b of res.data) {
      const sid = b.student_id
      if (!balanceMap[sid]) balanceMap[sid] = []
      balanceMap[sid].push(b)
    }

    // 计算每个学员的 total remaining
    const result = {}
    for (const sid of studentIds) {
      const items = balanceMap[sid] || []
      result[sid] = items.reduce((sum, b) => sum + (b.remaining || 0), 0)
    }

    return { success: true, data: result }
  } catch (err) {
    console.error('批量查余额失败', err)
    return { success: false, message: err.message }
  }
}
