const api = require('../../../utils/api')
const format = require('../../../utils/format')
const app = getApp()

Page({
  data: {
    studentName: '',
    parentPhone: '',
    loading: false
  },

  onNameInput(e) {
    this.setData({ studentName: e.detail.value.trim() })
  },

  onPhoneInput(e) {
    this.setData({ parentPhone: e.detail.value.trim() })
  },

  async onBind() {
    const { studentName, parentPhone } = this.data

    if (!studentName) {
      wx.showToast({ title: '请输入孩子姓名', icon: 'none' })
      return
    }

    if (!format.isPhone(parentPhone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      const res = await api.bindParent(studentName, parentPhone)
      if (res.success) {
        wx.showToast({ title: '绑定成功', icon: 'success' })
        app.globalData.role = 'parent'
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/parent/home/home' })
        }, 1500)
      }
    } catch (err) {
      // api.call 已处理 toast
    } finally {
      this.setData({ loading: false })
    }
  }
})
