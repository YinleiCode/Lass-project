// 保存课后反馈（upsert：存在则更新，不存在则创建）
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const ALLOWED_RATING_KEYS = ['breath', 'pronunciation', 'rhythm', 'emotion', 'confidence']

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

function hasTeacherAccess(student, teacher, openid) {
  if (!student || !teacher) return false
  if (student.owner_teacher_id && student.owner_teacher_id === teacher._id) return true
  if (student.owner_teacher_openid && student.owner_teacher_openid === openid) return true
  if (Array.isArray(student.teacher_ids) && student.teacher_ids.includes(teacher._id)) return true
  return false
}

async function hasScheduleAccess(schedule, teacher, openid) {
  if (!schedule || !teacher) return false
  if (schedule.teacher_id) return schedule.teacher_id === teacher._id

  const studentIds = Array.isArray(schedule.student_ids)
    ? Array.from(new Set(schedule.student_ids.filter(Boolean)))
    : []
  if (!studentIds.length) return false

  const studentRes = await db.collection('students').where({
    _id: _.in(studentIds)
  }).get()
  if (!studentRes.data || studentRes.data.length !== studentIds.length) return false
  return studentRes.data.every(student => hasTeacherAccess(student, teacher, openid))
}

exports.main = async (event, context) => {
  const { schedule_id, student_id, ratings, comment, audio_files } = event

  if (!schedule_id || !student_id) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const { openid, teacher } = await requireTeacher()
    const isAdmin = isAdminTeacher(teacher)

    const scheduleRes = await db.collection('schedules').doc(schedule_id).get()
    const schedule = scheduleRes.data
    if (!schedule || !Array.isArray(schedule.student_ids) || !schedule.student_ids.includes(student_id)) {
      return { success: false, message: '学员不属于该课程' }
    }
    if (!isAdmin && !await hasScheduleAccess(schedule, teacher, openid)) {
      return { success: false, message: '无权限填写该课程反馈', code: 403 }
    }
    if (schedule.status !== 'done') {
      return { success: false, message: '课程点名完成后才能填写反馈' }
    }

    const now = db.serverDate()
    const data = {
      schedule_id,
      student_id,
      teacher_id: schedule.teacher_id || teacher._id || '',
      teacher_name: schedule.teacher_name || teacher.name || '老师',
      updated_at: now
    }

    if (!ratings || typeof ratings !== 'object') {
      return { success: false, message: '请至少完成一项评分' }
    }

    const cleanRatings = {}
    for (const key of ALLOWED_RATING_KEYS) {
      if (ratings[key] !== undefined) {
        const value = Number(ratings[key])
        if (!Number.isInteger(value) || value < 1 || value > 5) {
          return { success: false, message: '评分不合法' }
        }
        cleanRatings[key] = value
      }
    }
    if (Object.keys(cleanRatings).length === 0) {
      return { success: false, message: '请至少完成一项评分' }
    }
    data.ratings = cleanRatings
    if (comment !== undefined) data.comment = String(comment).trim().slice(0, 500)
    if (audio_files) {
      if (!Array.isArray(audio_files) || audio_files.length > 5) return { success: false, message: '录音数量不合法' }
      data.audio_files = audio_files.map(f => String(f)).filter(Boolean).slice(0, 5)
    }

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
