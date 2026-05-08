// 家长提交请假
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { student_id, schedule_id, reason, remark } = event

  if (!student_id || !reason) {
    return { success: false, message: '请填写完整信息' }
  }

  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) {
      return { success: false, message: '未登录', code: 401 }
    }

    // 校验调用者是该学员的家长
    const studentRes = await db.collection('students').doc(student_id).get()
    const student = studentRes.data
    if (!student || student.parent_openid !== OPENID) {
      return { success: false, message: '无权限：仅该学员家长可请假', code: 403 }
    }

    await db.collection('leaves').add({
      data: {
        student_id,
        schedule_id: schedule_id || '',
        reason,
        remark: remark || '',
        openid: OPENID,
        status: 'pending',
        created_at: db.serverDate()
      }
    })

    return { success: true, message: '请假已提交' }
  } catch (err) {
    console.error('提交请假失败', err)
    return { success: false, message: err.message }
  }
}