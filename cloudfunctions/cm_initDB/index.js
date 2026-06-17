// 初始化数据库 - 创建所有集合 + 默认课程包；首位管理员需提供 INIT_SECRET
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_PACKAGES = [
  { name: '一对一 · 45分钟', unit_price: 200, duration_min: 45, type: '1v1',         is_active: true },
  { name: '小班课 · 60分钟', unit_price: 120, duration_min: 60, type: 'small_class', is_active: true },
  { name: '体验课 · 30分钟', unit_price: 0,   duration_min: 30, type: 'trial',       is_active: true }
]

function isAdminTeacher(teacher) {
  if (!teacher) return false
  const role = String(teacher.role || teacher.user_role || '').toLowerCase()
  return teacher.is_admin === true ||
    teacher.is_admin === 1 ||
    teacher.is_admin === 'true' ||
    teacher.is_admin === '1' ||
    teacher.isAdmin === true ||
    teacher.isAdmin === 1 ||
    teacher.isAdmin === 'true' ||
    teacher.isAdmin === '1' ||
    ['admin', 'super_admin', 'principal', 'owner'].includes(role)
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const expectedSecret = process.env.INIT_SECRET
  const hasInitSecret = !!(OPENID && expectedSecret && event.secret === expectedSecret)

  if (!hasInitSecret) {
    const adminRes = await db.collection('teachers')
      .where({ openid: OPENID })
      .limit(1)
      .get()
    if (!OPENID || adminRes.data.length === 0 || !isAdminTeacher(adminRes.data[0])) {
      return { success: false, message: '无权限：仅管理员可初始化数据库', code: 403 }
    }
  }

  const collections = [
    'teachers', 'students', 'course_packages', 'orders',
    'course_balance', 'schedules', 'attendance', 'feedbacks', 'leaves',
    'invite_codes', 'invite_attempts', 'parent_bind_attempts', 'student_audit_logs'
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

  // 2. Bootstrap: 仅当 teachers 表为空且提供 INIT_SECRET 时，把当前调用者写入为首位管理员
  if (hasInitSecret) {
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
    results.push({ name: 'teachers', status: 'bootstrap-skipped-secret-required' })
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
