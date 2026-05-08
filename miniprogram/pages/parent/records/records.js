const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const app = getApp()

Page({
  data: {
    loading: true,
    studentId: '',
    feedbacks: [],
    filter: 'all', // all | thisMonth | lastMonth
    filteredFeedbacks: [],
    format: format
  },

  onLoad(options) {
    const studentId = options.studentId || (app.globalData.userInfo && app.globalData.userInfo._id) || ''
    this.setData({ studentId })
    if (studentId) {
      this.loadData(studentId)
    }
  },

  onShow() {
    if (this.data.studentId) {
      this.loadData(this.data.studentId)
    } else {
      const studentId = app.globalData.userInfo && app.globalData.userInfo._id
      if (studentId) {
        this.setData({ studentId })
        this.loadData(studentId)
      }
    }
  },

  async loadData(studentId) {
    this.setData({ loading: true })
    try {
      const feedbacks = await api.getStudentFeedbacks(studentId, 50)
      this.setData({ feedbacks, loading: false })
      this.applyFilter()
    } catch (err) {
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

  goFeedbackDetail(e) {
    const { scheduleid, studentid } = e.currentTarget.dataset
    if (scheduleid && studentid) {
      wx.navigateTo({
        url: `/pages/parent/feedback-detail/feedback-detail?scheduleId=${scheduleid}&studentId=${studentid}`
      })
    }
  }
})
