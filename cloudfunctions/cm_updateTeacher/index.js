// 更新当前老师资料
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const name = event.name !== undefined ? String(event.name).trim() : undefined
  const phone = event.phone !== undefined ? String(event.phone).trim() : undefined

  if (name !== undefined && (!name || name.length > 20)) {
    return { success: false, message: '姓名不合法' }
  }

  if (phone !== undefined && phone && !/^1\d{10}$/.test(phone)) {
    return { success: false, message: '手机号不合法' }
  }

  const data = {}
  if (name !== undefined) data.name = name
  if (phone !== undefined) data.phone = phone

  if (Object.keys(data).length === 0) {
    return { success: false, message: '没有可更新字段' }
  }

  try {
    const { teacher } = await requireTeacher()
    data.updated_at = db.serverDate()

    await db.collection('teachers').doc(teacher._id).update({ data })

    return { success: true, message: '更新成功' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('更新老师资料失败', err)
    return { success: false, message: err.message || '更新失败' }
  }
}
