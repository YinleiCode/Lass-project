// 保存课后反馈（upsert：存在则更新，不存在则创建）
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { schedule_id, student_id, ratings, comment, audio_files } = event

  if (!schedule_id || !student_id) {
    return { success: false, message: '参数不完整' }
  }

  try {
    await requireTeacher()

    const now = db.serverDate()
    const data = { schedule_id, student_id, updated_at: now }

    if (ratings) data.ratings = ratings
    if (comment !== undefined) data.comment = comment
    if (audio_files) data.audio_files = audio_files

    // 查是否已有反馈
    const existRes = await db.collection('feedbacks').where({
      schedule_id,
      student_id
    }).get()

    if (existRes.data.length > 0) {
      await db.collection('feedbacks').doc(existRes.data[0]._id).update({ data })
      return { success: true, message: '反馈已更新' }
    } else {
      data.created_at = now
      const res = await db.collection('feedbacks').add({ data })
      return { success: true, message: '反馈已保存', feedbackId: res._id }
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('保存反馈失败', err)
    return { success: false, message: err.message }
  }
}