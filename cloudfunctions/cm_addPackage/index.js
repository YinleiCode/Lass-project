// 新增课程包
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
  const name = (event.name || '').trim()
  const unitPrice = Number(event.unit_price)
  const durationMin = Number(event.duration_min || 45)
  const type = event.type || '1v1'

  if (!name) {
    return { success: false, message: '请输入课程包名称' }
  }
  if (name.length > 40) return { success: false, message: '课程包名称过长' }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { success: false, message: '价格不合法' }
  if (!Number.isInteger(durationMin) || durationMin <= 0 || durationMin > 300) return { success: false, message: '课程时长不合法' }
  if (!['1v1', 'small_class', 'big_class', 'trial'].includes(type)) return { success: false, message: '课程类型不合法' }

  try {
    const { teacher } = await requireTeacher()
    if (!isAdminTeacher(teacher)) {
      return { success: false, message: '无权限：仅管理员可新增课程包', code: 403 }
    }

    const res = await db.collection('course_packages').add({
      data: {
        name,
        unit_price: unitPrice,
        duration_min: durationMin,
        type,
        is_active: true,
        created_at: db.serverDate()
      }
    })

    return { success: true, message: '添加成功', packageId: res._id }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('新增课程包失败', err)
    return { success: false, message: err.message }
  }
}
