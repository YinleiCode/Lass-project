const api = require('../../../utils/api')
const format = require('../../../utils/format')
const app = getApp()

Page({
  data: {
    loading: true,
    studentId: '',
    orders: [],
    totalAmount: 0,
    totalCourseCount: 0,
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
    if (!this.data.studentId) {
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
      const orders = await api.getOrders(studentId)
      const totalAmount = orders.reduce((s, o) => s + (o.amount || 0), 0)
      const totalCourseCount = orders.reduce((s, o) => s + (o.course_count || 0), 0)

      this.setData({
        orders,
        totalAmount,
        totalCourseCount,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
    }
  }
})
