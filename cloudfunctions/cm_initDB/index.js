// 初始化数据库 - 创建所有集合 + 引导首位管理员
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const collections = [
    'teachers', 'students', 'course_packages', 'orders',
    'course_balance', 'schedules', 'attendance', 'feedbacks', 'leaves',
    'invite_codes'
  ]

  const results = []

  for (const name of collections) {
    try {
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

  // Bootstrap: 仅当 teachers 表为空时，把当前调用者写入为首位管理员
  const { OPENID } = cloud.getWXContext()
  if (OPENID) {
    const teacherRes = await db.collection('teachers').limit(1).get()
    if (teacherRes.data.length === 0) {
      await db.collection('teachers').add({
        data: {
          openid: OPENID,
          name: event.teacherName || '管理员',
          created_at: db.serverDate(),
          is_admin: true
        }
      })
      results.push({ name: 'teachers', status: 'bootstrap-admin-created' })
    } else {
      results.push({ name: 'teachers', status: 'bootstrap-skipped-already-has-teachers' })
    }
  } else {
    results.push({ name: 'teachers', status: 'bootstrap-skipped-no-openid' })
  }

  return { success: true, results }
}
