// 更新课程包(启用/停用,或修改字段)
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { packageId, data } = event

  if (!packageId) {
    return { success: false, message: '缺少 packageId' }
  }
  if (!data || typeof data !== 'object') {
    return { success: false, message: '缺少更新数据' }
  }

  try {
    await requireTeacher()

    // 白名单字段:防止越权修改无关字段
    const allowedFields = ['name', 'unit_price', 'duration_min', 'type', 'is_active']
    const updateData = {}
    for (const key of allowedFields) {
      if (data[key] !== undefined) updateData[key] = data[key]
    }

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
