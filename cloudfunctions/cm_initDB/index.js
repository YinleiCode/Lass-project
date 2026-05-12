// 初始化数据库 - 创建所有集合 + 引导首位管理员 + 默认课程包
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_PACKAGES = [
  { name: '一对一 · 45分钟', unit_price: 200, duration_min: 45, type: '1v1',         is_active: true },
  { name: '小班课 · 60分钟', unit_price: 120, duration_min: 60, type: 'small_class', is_active: true },
  { name: '体验课 · 30分钟', unit_price: 0,   duration_min: 30, type: 'trial',       is_active: true }
]

exports.main = async (event, context) => {
  const collections = [
    'teachers', 'students', 'course_packages', 'orders',
    'course_balance', 'schedules', 'attendance', 'feedbacks', 'leaves',
    'invite_codes'
  ]

  const results = []

  // 1. 创建集合
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

  // 2. Bootstrap: 仅当 teachers 表为空时，把当前调用者写入为首位管理员
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

  // 3. 默认课程包初始化: 仅当 course_packages 表为空时插入
  try {
    const pkgRes = await db.collection('course_packages').limit(1).get()
    if (pkgRes.data.length === 0) {
      let count = 0
      for (const pkg of DEFAULT_PACKAGES) {
        try {
          await db.collection('course_packages').add({
            data: {
              ...pkg,
              created_at: db.serverDate()
            }
          })
          count++
        } catch (err) {
          results.push({ name: 'course_packages', status: 'insert-failed', package: pkg.name, message: err.message })
        }
      }
      results.push({ name: 'course_packages', status: `default-seeded-${count}-records` })
    } else {
      results.push({ name: 'course_packages', status: 'seed-skipped-already-has-data' })
    }
  } catch (err) {
    results.push({ name: 'course_packages', status: 'seed-error', message: err.message })
  }

  return { success: true, results }
}
