// 新增课程包
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { name, unit_price, duration_min, type } = event

  if (!name) {
    return { success: false, message: '请输入课程包名称' }
  }

  try {
    await requireTeacher()

    const res = await db.collection('course_packages').add({
      data: {
        name,
        unit_price: unit_price || 0,
        duration_min: duration_min || 45,
        type: type || '1v1',
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