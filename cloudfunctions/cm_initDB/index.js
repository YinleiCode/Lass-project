// 初始化数据库 - 创建所有集合
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const collections = [
    'teachers', 'students', 'course_packages', 'orders',
    'course_balance', 'schedules', 'attendance', 'feedbacks', 'leaves'
  ]

  const results = []

  for (const name of collections) {
    try {
      // 尝试创建集合
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (err) {
      if (err.errCode === -502005 || err.message.includes('already exists')) {
        results.push({ name, status: 'already exists' })
      } else {
        results.push({ name, status: 'error', message: err.message })
      }
    }
  }

  return { success: true, results }
}
