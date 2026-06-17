const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const role = require('../../../utils/role')
const app = getApp()

Page({
  data: {
    loading: true,
    studentId: '',
    teacherMode: false,
    pageTitle: '孩子的声音轨迹',
    feedbacks: [],
    filter: 'all', // all | thisMonth | lastMonth
    filteredFeedbacks: [],
    format: format
  },

  async onLoad(options = {}) {
    const studentId = options.studentId || ''
    this.setData({
      studentId,
      teacherMode: !!studentId,
      pageTitle: studentId ? '学员声音轨迹' : '孩子的声音轨迹'
    })
    const ok = await role.ensureParentAccess({ teacherMode: !!studentId })
    if (!ok) {
      this.setData({ loading: false })
      return
    }
    this.loadData()
  },

  onShow() {
    if (!this.data.teacherMode && this.getTabBar && this.getTabBar()) this.getTabBar().setSelected('/pages/parent/records/records')
    if (!this.data.loading) this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const feedbacks = this.data.teacherMode
        ? await api.getStudentFeedbacks(this.data.studentId, 100)
        : await api.getParentFeedbacks(50)
      const displayFeedbacks = feedbacks.map(f => this.buildFeedbackItem(f))
      this.setData({ feedbacks: displayFeedbacks, loading: false })
      this.applyFilter()
    } catch (err) {
      console.error('上课记录加载失败', err)
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
    const filtered = this.getFilteredFeedbacks()
    this.setData({ filteredFeedbacks: filtered })
  },

  getFilteredFeedbacks() {
    const { feedbacks, filter } = this.data
    if (filter === 'all') return feedbacks

    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    if (filter === 'thisMonth') {
      return feedbacks.filter(f => {
        const d = f.created_at ? new Date(f.created_at) : new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === thisMonth
      })
    }

    if (filter === 'lastMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
      return feedbacks.filter(f => {
        const d = f.created_at ? new Date(f.created_at) : new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === lastMonthStr
      })
    }

    return feedbacks
  },

  buildFeedbackItem(f) {
    const ratings = f.ratings || {}
    const scoreValues = Object.keys(ratings).map(k => Number(ratings[k])).filter(v => Number.isFinite(v) && v > 0)
    const avg = scoreValues.length
      ? Math.round(scoreValues.reduce((sum, v) => sum + v, 0) / scoreValues.length)
      : 0
    const comment = f.comment ? String(f.comment) : ''
    const dateSource = f.schedule_time || f.created_at
    return {
      ...f,
      dateText: format.datetime(dateSource) || format.datetime(f.created_at) || '',
      titleText: f.package_name || '上课反馈',
      commentPreview: comment ? (comment.length > 40 ? comment.substring(0, 40) + '...' : comment) : '暂无文字评语',
      scoreText: avg ? `评分 ${avg}/5` : '',
      audioText: f.audio_files && f.audio_files.length ? '语音回声' : ''
    }
  },

  goFeedbackDetail(e) {
    const { scheduleid } = e.currentTarget.dataset
    if (!scheduleid) {
      wx.showToast({ title: '回声数据不完整', icon: 'none' })
      return
    }
    if (this.data.teacherMode) {
      wx.navigateTo({
        url: `/pages/teacher/feedback/feedback?scheduleId=${scheduleid}&studentId=${this.data.studentId}`
      })
      return
    }
    wx.navigateTo({
      url: `/pages/parent/feedback-detail/feedback-detail?scheduleId=${scheduleid}`
    })
  }
})
