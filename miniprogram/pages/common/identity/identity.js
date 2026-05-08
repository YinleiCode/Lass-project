const app = getApp()

Page({
  data: {
    loading: true,
    showInviteForm: false,
    inviteCode: '',
    inviteName: '',
    verifying: false
  },

  onLoad() {
    this.checkIdentity()
  },

  async checkIdentity() {
    try {
      const role = await app.checkRole()
      if (role === 'teacher') {
        wx.reLaunch({ url: '/pages/teacher/home/home' })
      } else if (role === 'parent') {
        wx.reLaunch({ url: '/pages/parent/home/home' })
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('身份识别失败', err)
      this.setData({ loading: false })
    }
  },

  selectTeacher() {
    this.setData({
      showInviteForm: true,
      inviteCode: '',
      inviteName: ''
    })
  },

  onCodeInput(e) {
    this.setData({ inviteCode: e.detail.value.trim() })
  },

  onNameInput(e) {
    this.setData({ inviteName: e.detail.value.trim() })
  },

  cancelInviteForm() {
    this.setData({ showInviteForm: false })
  },

  async onVerifyCode() {
    const { inviteCode, inviteName } = this.data

    if (!inviteCode || !inviteName) {
      wx.showToast({ title: '请填写邀请码和姓名', icon: 'none' })
      return
    }

    if (!/^\d{6}$/.test(inviteCode)) {
      wx.showToast({ title: '邀请码为6位数字', icon: 'none' })
      return
    }

    this.setData({ verifying: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'cm_verifyInviteCode',
        data: { code: inviteCode, name: inviteName }
      })

      if (res.result.success) {
        wx.showToast({ title: '注册成功', icon: 'success' })
        app.globalData.role = 'teacher'
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/teacher/home/home' })
        }, 1500)
      } else {
        wx.showToast({ title: res.result.message || '验证失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '验证失败', icon: 'none' })
    } finally {
      this.setData({ verifying: false })
    }
  },

  selectParent() {
    wx.navigateTo({ url: '/pages/common/bindparent/bindparent' })
  }
})
