// 更新学员信息
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { studentId, data } = event

  if (!studentId) {
    return { success: false, message: '缺少学员ID' }
  }

  try {
    await requireTeacher()

    data.updated_at = db.serverDate()

    await db.collection('students').doc(studentId).update({ data })

    return { success: true, message: '已更新' }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('更新学员失败', err)
    return { success: false, message: err.message }
  }
}