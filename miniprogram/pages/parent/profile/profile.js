const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const role = require('../../../utils/role')
const app = getApp()

Page({
  data: {
    loading: true,
    student: null,
    studentName: '',
    avatarText: '?',
    maskedPhone: '',
    enrollDateText: '',
    switchedFromTeacher: false,
    format: format
  },

  async onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSelected('/pages/parent/profile/profile')
    const ok = await role.ensureParentAccess()
    if (!ok) {
      this.setData({ loading: false })
      return
    }
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
      const data = await api.getParentProfile()
      const student = data && data.student ? data.student : null
      const name = student && student.name ? student.name : '学员'
      this.setData({
        student,
        studentName: name,
        avatarText: name.substring(0, 1) || '?',
        maskedPhone: student && student.parent_phone ? format.maskPhone(student.parent_phone) : '',
        enrollDateText: student && student.enroll_date ? `入学 ${student.enroll_date}` : '',
        loading: false
      })
    } catch (err) {
      console.error('家长资料加载失败', err)
      wx.showToast({ title: (err && err.message) || '加载失败，请重试', icon: 'none' })
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
    if (!app.globalData._switchedFromTeacher || !app.globalData._originalTeacherInfo) {
      wx.showToast({ title: '当前账号不能切换视角', icon: 'none' })
      return
    }
    wx.showModal({
      title: '切回校长端',
      content: '将恢复为校长/管理员身份,确定吗?',
      success: (res) => {
        if (!res.confirm) return
        const original = app.globalData._originalTeacherInfo
        app.globalData.role = 'teacher'
        app.globalData.userInfo = original
        app.globalData._switchedFromTeacher = false
        app.globalData._originalTeacherInfo = null
        app.globalData._roleSwitchVersion = (app.globalData._roleSwitchVersion || 0) + 1
        wx.showToast({ title: '已切回', icon: 'success' })
        // reLaunch 清栈,避免 tab-bar 复用家长视角的 tabs
        wx.reLaunch({ url: '/pages/teacher/home/home' })
      }
    })
  }
})
