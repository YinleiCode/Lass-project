const api = require('../../../utils/api')
const format = require('../../../utils/format')
const app = getApp()

Page({
  data: {
    loading: true,
    stats: null,
    refreshing: false,
    todaySchedules: [],
    warningList: [],
    format: format
  },

  onShow() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadData()
  },

  async loadData() {
    try {
      const stats = await api.getStats()
      if (stats.success) {
        this.setData({
          stats: stats.data,
          todaySchedules: stats.data.todaySchedules || [],
          warningList: stats.data.warningList || [],
          loading: false,
          refreshing: false
        })
      }
    } catch (err) {
      this.setData({ loading: false, refreshing: false })
    }
    wx.stopPullDownRefresh()
  },

  goCheckin(e) {
    const scheduleId = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/teacher/checkin/checkin?scheduleId=${scheduleId}` })
  },

  goStudentDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/teacher/students/detail?id=${id}` })
  },

  goCalendar() {
    wx.switchTab({ url: '/pages/teacher/calendar/calendar' })
  },

  goStudents() {
    wx.switchTab({ url: '/pages/teacher/students/students' })
  }
})
