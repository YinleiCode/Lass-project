// 读取授课老师列表：管理员可看全部，普通老师只返回自己
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function isAdminTeacher(row) {
  if (!row) return false
  const role = String(row.role || row.user_role || '').toLowerCase()
  return row.is_admin === true ||
    row.is_admin === 1 ||
    row.is_admin === 'true' ||
    row.is_admin === '1' ||
    row.isAdmin === true ||
    row.isAdmin === 1 ||
    row.isAdmin === 'true' ||
    row.isAdmin === '1' ||
    ['admin', 'super_admin', 'principal', 'owner'].includes(role)
}

function toTeacherOption(row) {
  return {
    _id: row._id,
    name: row.name || '未命名老师',
    phone: row.phone || '',
    is_admin: isAdminTeacher(row),
    created_at: row.created_at || '',
    updated_at: row.updated_at || ''
  }
}

exports.main = async () => {
  try {
    const { teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)

    if (!isAdmin) {
      return {
        success: true,
        data: [toTeacherOption(teacher)],
        isAdmin: false,
        currentTeacherId: teacher._id
      }
    }

    const res = await db.collection('teachers')
      .orderBy('created_at', 'asc')
      .limit(100)
      .get()

    return {
      success: true,
      data: (res.data || []).map(toTeacherOption),
      isAdmin: true,
      currentTeacherId: teacher._id
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code, data: [] }
    }
    console.error('读取老师列表失败', err)
    return { success: false, message: err.message || '读取老师列表失败', data: [] }
  }
}
