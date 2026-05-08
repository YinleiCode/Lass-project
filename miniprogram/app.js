App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-1gy3z9g8fe36a368',
        traceUser: true
      })
    }

    // 获取用户openid
    this.getOpenid()
  },

  globalData: {
    openid: '',
    role: '',      // 'teacher' | 'parent' | ''
    userInfo: null
  },

  // 获取openid
  getOpenid: function () {
    return new Promise((resolve, reject) => {
      if (this.globalData.openid) {
        resolve(this.globalData.openid)
        return
      }
      wx.cloud.callFunction({
        name: 'cm_login',
        data: {},
        success: res => {
          this.globalData.openid = res.result.openid
          resolve(res.result.openid)
        },
        fail: err => {
          console.error('获取openid失败', err)
          reject(err)
        }
      })
    })
  },

  // 检查用户角色
  checkRole: function () {
    return new Promise(async (resolve, reject) => {
      try {
        const openid = await this.getOpenid()
        const db = wx.cloud.database()

        // 先查老师表
        const teacherRes = await db.collection('teachers').where({
          openid: openid
        }).get()

        if (teacherRes.data.length > 0) {
          this.globalData.role = 'teacher'
          this.globalData.userInfo = teacherRes.data[0]
          resolve('teacher')
          return
        }

        // 再查学员表(家长绑定)
        const studentRes = await db.collection('students').where({
          parent_openid: openid
        }).get()

        if (studentRes.data.length > 0) {
          this.globalData.role = 'parent'
          this.globalData.userInfo = studentRes.data[0]
          resolve('parent')
          return
        }

        // 未识别身份
        this.globalData.role = ''
        resolve('')
      } catch (err) {
        reject(err)
      }
    })
  }
})
