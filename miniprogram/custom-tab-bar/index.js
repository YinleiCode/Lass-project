const app = getApp()
const NATIVE_TAB_PATHS = [
  '/pages/teacher/home/home',
  '/pages/teacher/calendar/calendar',
  '/pages/teacher/students/students',
  '/pages/teacher/profile/profile'
]

Component({
  data: {
    role: '',
    selected: 0,
    tabs: []
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  pageLifetimes: {
    // 每次宿主页面 show 都强制刷新,避免 globalData.role 变更后 tab-bar 不同步
    // (尤其是开发者工具'切换视角'后,role 变了但 tabs 没刷新的 bug)
    show() {
      this.refresh()
      setTimeout(() => this.refresh(), 80)
    }
  },

  methods: {
    refresh() {
      const role = app.globalData.role
      const tabs = this.getTabs(role)
      const pendingPath = app.globalData._pendingTabPath || ''
      let selected = this.getSelectedIndex(role)
      if (pendingPath) {
        const pendingIndex = tabs.findIndex(t => t.path === pendingPath)
        if (pendingIndex >= 0) selected = pendingIndex
      }
      this.setData({
        role,
        tabs,
        selected
      })
    },

    getTabs(role) {
      if (role === 'teacher') {
        return [
          { text: '首页', icon: '⌂', path: '/pages/teacher/home/home' },
          { text: '课表', icon: '◷', path: '/pages/teacher/calendar/calendar' },
          { text: '学员', icon: '◎', path: '/pages/teacher/students/students' },
          { text: '我的', icon: '◌', path: '/pages/teacher/profile/profile' }
        ]
      }
      return [
        { text: '首页', icon: '⌂', path: '/pages/parent/home/home' },
        { text: '记录', icon: '◇', path: '/pages/parent/records/records' },
        { text: '我的', icon: '◌', path: '/pages/parent/profile/profile' }
      ]
    },

    getSelectedIndex(role) {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      if (!currentPage) return 0
      const route = currentPage.route || ''
      const tabs = this.getTabs(role)
      const idx = tabs.findIndex(t => route === t.path.replace(/^\//, ''))
      return idx >= 0 ? idx : 0
    },

    setSelected(path) {
      if (path) app.globalData._pendingTabPath = path
      const role = this.data.role || app.globalData.role
      const tabs = this.data.tabs.length ? this.data.tabs : this.getTabs(role)
      const selected = tabs.findIndex(t => t.path === path || t.path.replace(/^\//, '') === path)
      if (selected >= 0) this.setData({ role, tabs, selected })
    },

    switchTab(e) {
      const path = e.currentTarget.dataset.path
      if (!path) return
      app.globalData._pendingTabPath = path
      this.setSelected(path)
      if (!NATIVE_TAB_PATHS.includes(path)) {
        wx.reLaunch({
          url: path,
          success: () => {
            this.setSelected(path)
            setTimeout(() => this.refresh(), 80)
          },
          fail: relaunchErr => {
            console.error('底部导航跳转失败', relaunchErr)
            app.globalData._pendingTabPath = ''
            this.refresh()
            wx.showToast({ title: '页面跳转失败', icon: 'none' })
          }
        })
        return
      }
      wx.switchTab({
        url: path,
        success: () => {
          this.setSelected(path)
          setTimeout(() => this.refresh(), 80)
        },
        fail: err => {
          console.warn('switchTab 失败, 尝试 reLaunch', path, err)
          wx.reLaunch({
            url: path,
            success: () => {
              this.setSelected(path)
              setTimeout(() => this.refresh(), 80)
            },
            fail: relaunchErr => {
              console.error('底部导航跳转失败', relaunchErr)
              app.globalData._pendingTabPath = ''
              this.refresh()
              wx.showToast({ title: '页面跳转失败', icon: 'none' })
            }
          })
        }
      })
    }
  }
})
