// 家长身份绑定
const cloud = require('wx-server-sdk')
const { requireAnyUser, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { studentName, parentPhone } = event

  if (!studentName || !parentPhone) {
    return { success: false, message: '请输入孩子姓名和手机号' }
  }

  try {
    const { openid } = await requireAnyUser()

    // 查找匹配的学员
    const res = await db.collection('students').where({
      name: studentName,
      parent_phone: parentPhone
    }).get()

    if (res.data.length === 0) {
      return { success: false, message: '未找到匹配的学员，请联系老师确认信息' }
    }

    // 绑定openid（可能有多个孩子匹配同一手机号）
    for (const student of res.data) {
      await db.collection('students').doc(student._id).update({
        data: {
          parent_openid: openid,
          updated_at: db.serverDate()
        }
      })
    }

    return {
      success: true,
      message: '绑定成功',
      students: res.data.map(s => ({ _id: s._id, name: s.name }))
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('绑定失败', err)
    return { success: false, message: '绑定失败: ' + err.message }
  }
}
