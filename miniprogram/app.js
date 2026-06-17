const CLOUD_ENV = 'cloud1-d4gerzfz6069ec252'

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: CLOUD_ENV,
        traceUser: true
      })
    }

    // 获取用户openid
    this.getOpenid()
  },

  globalData: {
    openid: '',
    role: '',      // 'teacher' | 'parent' | ''
    userInfo: null,
    // 开发/测试用:管理员临时切换为家长视角时为 true,冷启动后失效
    _switchedFromTeacher: false,
    // 切换前保存的老师信息,用于切回
    _originalTeacherInfo: null,
    // 自定义 tabBar 点击后立即高亮用
    _pendingTabPath: '',
    // 角色切换版本号,防止慢返回的 checkRole 覆盖刚切好的测试视角
    _roleSwitchVersion: 0,
    cloudEnv: CLOUD_ENV
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
  checkRole: function (options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const switchVersionAtStart = this.globalData._roleSwitchVersion || 0
        const switchedAtStart = !!this.globalData._switchedFromTeacher
        if (!options.ignoreSwitch && this.globalData._switchedFromTeacher && this.globalData.userInfo && this.globalData.userInfo._id) {
          this.globalData.role = 'parent'
          resolve('parent')
          return
        }
        if (options.ignoreSwitch && this.globalData._switchedFromTeacher) {
          this.globalData._switchedFromTeacher = false
          this.globalData._originalTeacherInfo = null
          this.globalData._roleSwitchVersion = (this.globalData._roleSwitchVersion || 0) + 1
        }
        await this.getOpenid()
        const res = await wx.cloud.callFunction({ name: 'cm_checkRole', data: {} })
        const result = res.result || {}
        if (!result.success) throw new Error(result.message || '身份识别失败')

        const switchedDuringRequest = this.globalData._switchedFromTeacher &&
          (!switchedAtStart || this.globalData._roleSwitchVersion !== switchVersionAtStart)
        if (switchedDuringRequest && this.globalData.userInfo && this.globalData.userInfo._id) {
          this.globalData.role = 'parent'
          resolve('parent')
          return
        }

        this.globalData.role = result.role || ''
        this.globalData.userInfo = result.userInfo || null
        resolve(this.globalData.role)
      } catch (err) {
        reject(err)
      }
    })
  }
})
