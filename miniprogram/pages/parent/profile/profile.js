const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const app = getApp()

Page({
  data: {
    loading: true,
    student: null,
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
      this.setData({ student, loading: false })
    } catch (err) {
      this.setData({ loading: false })
    }
  },

  rebind() {
    wx.showModal({
      title: '重新绑定',
      content: '重新绑定后将解绑当前账号，确定吗？',
      success: (res) => {
        if (res.confirm) {
          wx.reLaunch({ url: '/pages/common/bindparent/bindparent' })
        }
      }
    })
  }
})
