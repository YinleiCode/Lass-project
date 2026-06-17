// 一次性清空项目业务数据
// 调用参数: { confirm: 'CLEAR_COURSE_DATA', includeTeachers: false }
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const BUSINESS_COLLECTIONS = [
  'students',
  'course_packages',
  'orders',
  'course_balance',
  'schedules',
  'attendance',
  'feedbacks',
  'leaves',
  'invite_codes',
  'invite_attempts',
  'parent_bind_attempts',
  'student_audit_logs'
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

async function requireAdmin() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw { code: 401, message: '未登录' }

  const res = await db.collection('teachers')
    .where({ openid: OPENID })
    .limit(1)
    .get()

  if (res.data.length === 0 || !isAdminTeacher(res.data[0])) throw { code: 403, message: '仅管理员可清空数据' }
  return OPENID
}

async function clearCollection(name) {
  let removed = 0

  while (true) {
    const res = await db.collection(name).limit(100).get()
    if (res.data.length === 0) break

    const ids = res.data.map(item => item._id).filter(Boolean)
    if (!ids.length) break
    const removeRes = await db.collection(name).where({ _id: _.in(ids) }).remove()
    removed += (removeRes && removeRes.stats && removeRes.stats.removed) || ids.length
  }

  return removed
}

exports.main = async (event) => {
  if (!event || event.confirm !== 'CLEAR_COURSE_DATA') {
    return {
      success: false,
      message: '缺少确认口令: CLEAR_COURSE_DATA'
    }
  }

  try {
    await requireAdmin()

    const collections = event.includeTeachers
      ? BUSINESS_COLLECTIONS.concat(['teachers'])
      : BUSINESS_COLLECTIONS

    const results = []
    for (const name of collections) {
      try {
        const removed = await clearCollection(name)
        results.push({ collection: name, removed })
      } catch (err) {
        results.push({ collection: name, removed: 0, error: err.message })
      }
    }

    return {
      success: true,
      message: event.includeTeachers ? '已清空全部数据，包括 teachers' : '已清空业务数据，保留 teachers',
      results
    }
  } catch (err) {
    if (err && (err.code === 401 || err.code === 403)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('清空数据失败', err)
    return { success: false, message: '清空数据失败' }
  }
}
