const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')

Page({
  data: {
    loading: true,
    schedule: null,
    student: null,
    studentId: '',
    scheduleId: '',
    ratings: {},
    comment: '',
    audioFileId: '',
    dimensions: constants.FEEDBACK_DIMENSIONS,
    submitting: false,
    currentStudentIndex: 0,
    students: []
  },

  onLoad(options) {
    const { scheduleId, studentId } = options
    this.setData({ scheduleId })
    if (studentId) {
      this.setData({ studentId })
    }
    this.loadData(scheduleId, studentId)
  },

  async loadData(scheduleId, studentId) {
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const scheduleRes = await db.collection('schedules').doc(scheduleId).get()
      const schedule = scheduleRes.data

      const allStudents = await api.getStudents({})
      const enrolled = allStudents.filter(s => schedule.student_ids.includes(s._id))

      // 默认选中第一个学员
      const targetStudentId = studentId || (enrolled.length > 0 ? enrolled[0]._id : '')
      const student = enrolled.find(s => s._id === targetStudentId)

      // 加载已有反馈
      let existingFeedback = null
      if (targetStudentId) {
        existingFeedback = await api.getFeedback(scheduleId, targetStudentId)
      }

      const ratings = {}
      for (const dim of constants.FEEDBACK_DIMENSIONS) {
        ratings[dim.key] = (existingFeedback && existingFeedback.ratings && existingFeedback.ratings[dim.key]) || 0
      }

      this.setData({
        schedule,
        students: enrolled,
        student: student || enrolled[0] || null,
        studentId: targetStudentId,
        ratings,
        comment: existingFeedback ? (existingFeedback.comment || '') : '',
        audioFileId: existingFeedback ? (existingFeedback.audio_files && existingFeedback.audio_files[0]) || '' : '',
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
    }
  },

  onRatingChange(e) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`ratings.${key}`]: e.detail.value
    })
  },

  onCommentInput(e) {
    this.setData({ comment: e.detail.value })
  },

  useTemplate(e) {
    const type = e.currentTarget.dataset.type
    const template = constants.FEEDBACK_TEMPLATES[type]
    if (template && this.data.student) {
      const name = this.data.student.name
      const dimension = '气息控制' // 默认维度
      this.setData({
        comment: template.replace('{name}', name).replace('{dimension}', dimension)
      })
    }
  },

  onAudioChange(e) {
    this.setData({ audioFileId: e.detail.fileID })
  },

  switchStudent(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const student = this.data.students[index]
    if (student && student._id !== this.data.studentId) {
      // 保存当前再切换
      this.loadData(this.data.scheduleId, student._id)
    }
  },

  async onSave() {
    const { scheduleId, studentId, ratings, comment, audioFileId } = this.data

    if (!studentId) {
      wx.showToast({ title: '请选择学员', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const data = {
        schedule_id: scheduleId,
        student_id: studentId,
        ratings,
        comment,
        audio_files: audioFileId ? [audioFileId] : []
      }

      await api.saveFeedback(data)
      wx.showToast({ title: '反馈已保存', icon: 'success' })

      // 如果还有下一个学员未反馈，自动切换
      const currentIdx = this.data.students.findIndex(s => s._id === studentId)
      if (currentIdx >= 0 && currentIdx < this.data.students.length - 1) {
        const nextStudent = this.data.students[currentIdx + 1]
        this.loadData(scheduleId, nextStudent._id)
      } else {
        setTimeout(() => wx.navigateBack(), 1500)
      }
    } catch (err) {
      this.setData({ submitting: false })
    }
  }
})
