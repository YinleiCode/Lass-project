const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')

Page({
  data: {
    loading: true,
    student: null,
    balances: [],
    orders: [],
    feedbacks: [],
    totalPaid: 0,
    totalFeedbackCount: 0,
    totalRemaining: 0,
    format: format
  },

  onLoad(options) {
    if (options.id) {
      this.loadData(options.id)
    }
  },

  async loadData(id) {
    this.setData({ loading: true })
    try {
      const student = await api.getStudent(id)
      const balances = await api.getBalance(id)
      const orders = await api.getOrders(id)
      const feedbacks = await api.getStudentFeedbacks(id, 10)

      const totalPaid = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
      const totalRemaining = balances.reduce((sum, b) => sum + (b.remaining || 0), 0)

      this.setData({
        student,
        balances,
        orders: orders.slice(0, 5),
        feedbacks,
        totalPaid,
        totalFeedbackCount: feedbacks.length,
        totalRemaining,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
    }
  },

  goPayment() {
    wx.navigateTo({ url: `/pages/teacher/payment/payment?studentId=${this.data.student._id}` })
  },

  goEdit() {
    wx.navigateTo({ url: `/pages/teacher/students/add?id=${this.data.student._id}` })
  },

  goAllOrders() {
    wx.navigateTo({ url: `/pages/parent/payment-list/payment-list?studentId=${this.data.student._id}` })
  },

  goAllFeedbacks() {
    wx.navigateTo({ url: `/pages/parent/records/records?studentId=${this.data.student._id}` })
  }
})
