const api = require('../../../utils/api')
const format = require('../../../utils/format')

Page({
  data: {
    loading: true,
    studentId: '',
    studentName: '学员',
    feedbacks: [],
    filter: 'all',
    filteredFeedbacks: []
  },

  onLoad(options = {}) {
    const studentId = options.studentId || ''
    if (!studentId) {
      wx.showToast({ title: '缺少学员信息', icon: 'none' })
      this.setData({ loading: false })
      return
    }
    this.setData({ studentId })
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const detail = await api.getStudentDetail(this.data.studentId, { feedbackLimit: 100 })
      if (!detail) throw new Error('学员不存在或无权访问')
      const student = detail.student || null
      const feedbacks = detail.feedbacks || []
      const displayFeedbacks = (feedbacks || []).map(f => this.buildFeedbackItem(f))
      this.setData({
        studentName: student && student.name ? student.name : '学员',
        feedbacks: displayFeedbacks,
        loading: false
      })
      this.applyFilter()
    } catch (err) {
      console.error('学员反馈加载失败', err)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  setFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ filter })
    this.applyFilter()
  },

  applyFilter() {
    const filteredFeedbacks = this.getFilteredFeedbacks()
    this.setData({ filteredFeedbacks })
  },

  getFilteredFeedbacks() {
    const { feedbacks, filter } = this.data
    if (filter === 'all') return feedbacks

    const now = new Date()
    const monthText = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const currentMonth = monthText(now)
    const prevMonth = monthText(new Date(now.getFullYear(), now.getMonth() - 1, 1))

    return feedbacks.filter(item => {
      const date = item.rawDate ? new Date(item.rawDate) : null
      if (!date || Number.isNaN(date.getTime())) return false
      const targetMonth = monthText(date)
      return filter === 'thisMonth' ? targetMonth === currentMonth : targetMonth === prevMonth
    })
  },

  buildFeedbackItem(f) {
    const ratings = f.ratings || {}
    const values = Object.keys(ratings).map(k => Number(ratings[k])).filter(v => Number.isFinite(v) && v > 0)
    const avg = values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0
    const comment = f.comment ? String(f.comment) : ''
    const rawDate = f.schedule_time || f.created_at || ''
    return {
      ...f,
      rawDate,
      scheduleId: f.schedule_id || '',
      dateText: format.datetime(rawDate) || format.datetime(f.created_at) || '未记录时间',
      titleText: f.package_name || '课后回声',
      commentPreview: comment ? (comment.length > 44 ? comment.substring(0, 44) + '...' : comment) : '暂无文字评语',
      scoreText: avg ? `评分 ${avg}/5` : '',
      audioText: f.audio_files && f.audio_files.length ? '语音' : ''
    }
  },

  goFeedback(e) {
    const { scheduleid } = e.currentTarget.dataset
    if (!scheduleid || !this.data.studentId) {
      wx.showToast({ title: '回声数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/teacher/feedback/feedback?scheduleId=${scheduleid}&studentId=${this.data.studentId}`
    })
  }
})
