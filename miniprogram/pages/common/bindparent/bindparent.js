const api = require('../../../utils/api')
const format = require('../../../utils/format')
const app = getApp()

function withTimeout(promise, ms = 12000) {
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('绑定超时，请稍后重试')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

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
      const res = await withTimeout(api.bindParent(studentName, parentPhone))
      if (res.success) {
        const firstStudent = res.student || (res.students && res.students[0])
        wx.showToast({ title: '绑定成功', icon: 'success' })
        app.globalData.role = 'parent'
        app.globalData.userInfo = firstStudent || null
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/parent/home/home' })
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '绑定失败', icon: 'none' })
      }
    } catch (err) {
      const msg = (err && (err.message || err.errMsg)) || '绑定失败，请重试'
      wx.showToast({ title: msg, icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
