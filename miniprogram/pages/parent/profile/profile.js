const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const app = getApp()

Page({
  data: {
    loading: true,
    student: null,
    switchedFromTeacher: false,
    format: format
  },

  onShow() {
    const userInfo = app.globalData.userInfo
    this.setData({ switchedFromTeacher: !!app.globalData._switchedFromTeacher })
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
  },

  // === 开发者工具:切回老师视角 ===
  onSwitchBackToTeacher() {
    wx.showModal({
      title: '切回老师视角',
      content: '将恢复为老师身份,确定吗?',
      success: (res) => {
        if (!res.confirm) return
        const original = app.globalData._originalTeacherInfo
        app.globalData.role = 'teacher'
        app.globalData.userInfo = original
        app.globalData._switchedFromTeacher = false
        app.globalData._originalTeacherInfo = null
        wx.showToast({ title: '已切回', icon: 'success' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/teacher/home/home' })
        }, 600)
      }
    })
  }
})
