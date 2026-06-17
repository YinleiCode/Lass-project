// 更新课程包(启用/停用,或修改字段)
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
  const { packageId, data } = event

  if (!packageId) {
    return { success: false, message: '缺少 packageId' }
  }
  if (!data || typeof data !== 'object') {
    return { success: false, message: '缺少更新数据' }
  }

  try {
    const { teacher } = await requireTeacher()
    if (!isAdminTeacher(teacher)) {
      return { success: false, message: '无权限：仅管理员可管理课程包', code: 403 }
    }

    // 白名单字段:防止越权修改无关字段
    const allowedFields = ['name', 'unit_price', 'duration_min', 'type', 'is_active']
    const updateData = {}
    for (const key of allowedFields) {
      if (data[key] !== undefined) updateData[key] = data[key]
    }

    if (updateData.name !== undefined) {
      updateData.name = String(updateData.name).trim()
      if (!updateData.name || updateData.name.length > 40) return { success: false, message: '课程包名称不合法' }
    }
    if (updateData.unit_price !== undefined) {
      updateData.unit_price = Number(updateData.unit_price)
      if (!Number.isFinite(updateData.unit_price) || updateData.unit_price < 0) return { success: false, message: '价格不合法' }
    }
    if (updateData.duration_min !== undefined) {
      updateData.duration_min = Number(updateData.duration_min)
      if (!Number.isInteger(updateData.duration_min) || updateData.duration_min <= 0 || updateData.duration_min > 300) return { success: false, message: '课程时长不合法' }
    }
    if (updateData.type !== undefined && !['1v1', 'small_class', 'big_class', 'trial'].includes(updateData.type)) {
      return { success: false, message: '课程类型不合法' }
    }
    if (updateData.is_active !== undefined) updateData.is_active = !!updateData.is_active

    if (Object.keys(updateData).length === 0) {
      return { success: false, message: '没有可更新字段' }
    }

    updateData.updated_at = db.serverDate()

    await db.collection('course_packages').doc(packageId).update({
      data: updateData
    })

    return { success: true, message: '更新成功' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('更新课程包失败', err)
    return { success: false, message: err.message }
  }
}
