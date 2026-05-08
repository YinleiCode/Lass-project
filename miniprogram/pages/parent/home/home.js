const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const app = getApp()

Page({
  data: {
    loading: true,
    student: null,
    balances: [],
    totalRemaining: 0,
    upcomingSchedules: [],
    latestFeedback: null,
    hasAudio: false,
    format: format
  },

  onShow() {
    const userInfo = app.globalData.userInfo
    if (userInfo && userInfo._id) {
      this.loadData(userInfo._id)
    } else {
      this.setData({ loading: false })
    }
  },

  async loadData(studentId) {
    this.setData({ loading: true })
    try {
      const student = await api.getStudent(studentId)
      const balances = await api.getBalance(studentId)
      const totalRemaining = balances.reduce((s, b) => s + (b.remaining || 0), 0)

      // 查找即将上课的排课
      const today = format.date(new Date())
      const schedules = await api.getSchedules({
        start_time: { $gte: today + ' 00:00' }
      })

      // 筛选属于这个学员的排课
      const upcoming = schedules.filter(s =>
        s.student_ids && s.student_ids.includes(studentId) && s.status === 'pending'
      ).slice(0, 3)

      // 最新反馈
      const feedbacks = await api.getStudentFeedbacks(studentId, 1)
      const latestFeedback = feedbacks.length > 0 ? feedbacks[0] : null

      this.setData({
        student,
        balances,
        totalRemaining,
        upcomingSchedules: upcoming,
        latestFeedback,
        hasAudio: latestFeedback && latestFeedback.audio_files && latestFeedback.audio_files.length > 0,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
    }
  },

  goRecords() {
    wx.switchTab({ url: '/pages/parent/records/records' })
  },

  goLeave() {
    wx.navigateTo({ url: '/pages/parent/leave/leave' })
  },

  goPaymentList() {
    wx.navigateTo({ url: '/pages/parent/payment-list/payment-list' })
  },

  goFeedbackDetail() {
    if (this.data.latestFeedback) {
      wx.navigateTo({
        url: `/pages/parent/feedback-detail/feedback-detail?scheduleId=${this.data.latestFeedback.schedule_id || ''}&studentId=${this.data.student._id}`
      })
    }
  }
})
