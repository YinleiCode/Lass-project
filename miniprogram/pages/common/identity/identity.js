const app = getApp()

Page({
  data: {
    loading: true
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
    // 老师首次进入，注册老师身份
    wx.showModal({
      title: '确认',
      content: '确认以老师身份使用？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const openid = await app.getOpenid()
            const db = wx.cloud.database()
            await db.collection('teachers').add({
              data: {
                openid: openid,
                name: '老师',
                created_at: db.serverDate()
              }
            })
            app.globalData.role = 'teacher'
            wx.reLaunch({ url: '/pages/teacher/home/home' })
          } catch (err) {
            wx.showToast({ title: '注册失败', icon: 'none' })
          }
        }
      }
    })
  },

  selectParent() {
    wx.navigateTo({ url: '/pages/common/bindparent/bindparent' })
  }
})
