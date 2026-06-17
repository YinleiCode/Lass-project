const api = require('../../../utils/api')
const format = require('../../../utils/format')
const permission = require('../../../utils/permission')
const app = getApp()

Page({
  data: {
    loading: true,
    studentId: '',
    teacherMode: false,
    orders: [],
    totalAmount: 0,
    totalAmountText: '¥0',
    totalCourseCount: 0,
    hasOrders: false
  },

  onLoad(options = {}) {
    const studentId = options.studentId || ''
    wx.setNavigationBarTitle({ title: '课程记录' })
    this.setData({
      studentId,
      teacherMode: options.teacher === '1' && !!studentId
    })
    this.loadData()
  },

  onShow() {
    if (!this.data.loading) this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      if (this.data.teacherMode) {
        try {
          await app.checkRole()
        } catch (e) {
          console.error('刷新身份失败', e)
        }
        if (!permission.isAdminUser(app.globalData.userInfo)) {
          wx.showToast({ title: '仅校长/管理员可查看', icon: 'none' })
          this.setData({ loading: false, teacherMode: false })
          return
        }
        wx.setNavigationBarTitle({ title: '缴费记录' })
        const orders = await api.getOrders(this.data.studentId)
        const displayOrders = (orders || []).map(o => ({
          ...o,
          amountText: format.money(o.amount || 0),
          payDateText: o.pay_date || format.date(o.created_at) || '',
          courseCountText: `+${o.course_count || 0}节`,
          packageNameText: o.package_name || '课程包',
          payMethodText: o.pay_method || '未记录'
        }))
        const totalAmount = displayOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0)
        const totalCourseCount = displayOrders.reduce((sum, o) => sum + Number(o.course_count || 0), 0)
        this.setData({
          orders: displayOrders,
          totalAmount,
          totalAmountText: format.money(totalAmount),
          totalCourseCount,
          hasOrders: displayOrders.length > 0,
          loading: false
        })
        return
      }
      wx.showToast({ title: '当前账号不能查看此页面', icon: 'none' })
      this.setData({
        orders: [],
        totalAmount: 0,
        totalAmountText: '¥0',
        totalCourseCount: 0,
        hasOrders: false,
        loading: false
      })
      return
    } catch (err) {
      console.error('缴费记录加载失败', err)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
  }
})
