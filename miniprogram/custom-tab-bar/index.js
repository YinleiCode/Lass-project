const app = getApp()

Component({
  data: {
    role: '',
    selected: 0,
    tabs: []
  },

  lifetimes: {
    attached() {
      const role = app.globalData.role
      this.setData({
        role,
        tabs: this.getTabs(role),
        selected: this.getSelectedIndex(role)
      })
    }
  },

  pageLifetimes: {
    show() {
      const role = app.globalData.role
      if (role !== this.data.role) {
        this.setData({
          role,
          tabs: this.getTabs(role),
          selected: this.getSelectedIndex(role)
        })
      }
    }
  },

  methods: {
    getTabs(role) {
      if (role === 'teacher') {
        return [
          { text: '首页', icon: '🏠', path: '/pages/teacher/home/home' },
          { text: '课表', icon: '📅', path: '/pages/teacher/calendar/calendar' },
          { text: '学员', icon: '👥', path: '/pages/teacher/students/students' },
          { text: '我的', icon: '👤', path: '/pages/teacher/profile/profile' }
        ]
      }
      return [
        { text: '首页', icon: '🏠', path: '/pages/parent/home/home' },
        { text: '记录', icon: '📋', path: '/pages/parent/records/records' },
        { text: '我的', icon: '👤', path: '/pages/parent/profile/profile' }
      ]
    },

    getSelectedIndex(role) {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      if (!currentPage) return 0
      const route = currentPage.route || ''
      const tabs = this.getTabs(role)
      const idx = tabs.findIndex(t => route.startsWith(t.path.replace('/pages/', '').replace(/\/[^/]+$/, '')))
      return idx >= 0 ? idx : 0
    },

    switchTab(e) {
      const path = e.currentTarget.dataset.path
      wx.switchTab({ url: path })
    }
  }
})
