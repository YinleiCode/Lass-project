const api = require('../../../utils/api')
const format = require('../../../utils/format')
const app = getApp()

// localStorage key 用于记忆引导卡片关闭状态
const GUIDE_KEYS = {
  STUDENTS: 'guide_dismissed_first_student',
  SCHEDULES: 'guide_dismissed_first_schedule',
  PACKAGES: 'guide_dismissed_first_package'
}

Page({
  data: {
    loading: true,
    stats: null,
    refreshing: false,
    todaySchedules: [],
    warningList: [],
    isAdmin: false,
    // 首次引导
    showStudentsGuide: false,
    showSchedulesGuide: false,
    showPackagesGuide: false,
    format: format
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSelected('/pages/teacher/home/home')
    this.loadData()
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadData()
  },

  async loadData() {
    try {
      const stats = await api.getStats()
      if (stats.success) {
        this.setData({
          stats: stats.data,
          isAdmin: !!stats.data.isAdmin,
          todaySchedules: stats.data.todaySchedules || [],
          warningList: stats.data.warningList || [],
          loading: false,
          refreshing: false
        })
      }
      // 并行检查引导条件(不阻塞主流程)
      this.checkGuides()
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '首页加载失败，请重试', icon: 'none' })
      this.setData({ loading: false, refreshing: false })
    }
    wx.stopPullDownRefresh()
  },

  // 检查是否需要展示首次引导
  async checkGuides() {
    try {
      const [students, schedules, packages] = await Promise.all([
        api.getStudents({}),
        api.getSchedules({}),
        api.getPackages()
      ])

      const dismissedStudents = wx.getStorageSync(GUIDE_KEYS.STUDENTS)
      const dismissedSchedules = wx.getStorageSync(GUIDE_KEYS.SCHEDULES)
      const dismissedPackages = wx.getStorageSync(GUIDE_KEYS.PACKAGES)

      // 优先级:课程包 > 学员 > 排课(因为缴费/排课都依赖课程包)
      const noPkg = packages.length === 0
      const noStu = students.length === 0
      const noSch = schedules.length === 0

      this.setData({
        showPackagesGuide: noPkg && !dismissedPackages,
        showStudentsGuide: !noPkg && noStu && !dismissedStudents,
        showSchedulesGuide: !noPkg && !noStu && noSch && !dismissedSchedules
      })
    } catch (err) {
      console.error('引导检查失败', err)
    }
  },

  // 引导:跳转操作
  goAddStudent() {
    wx.navigateTo({ url: '/pages/teacher/students/add' })
  },

  goAddSchedule() {
    wx.switchTab({ url: '/pages/teacher/calendar/calendar' })
  },

  goAddPackage() {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '请联系管理员配置课程包', icon: 'none' })
      return
    }
    wx.switchTab({ url: '/pages/teacher/profile/profile' })
  },

  // 引导:关闭(记忆 dismiss 状态)
  dismissGuide(e) {
    const type = e.currentTarget.dataset.type
    if (type === 'students') {
      wx.setStorageSync(GUIDE_KEYS.STUDENTS, true)
      this.setData({ showStudentsGuide: false })
    } else if (type === 'schedules') {
      wx.setStorageSync(GUIDE_KEYS.SCHEDULES, true)
      this.setData({ showSchedulesGuide: false })
    } else if (type === 'packages') {
      wx.setStorageSync(GUIDE_KEYS.PACKAGES, true)
      this.setData({ showPackagesGuide: false })
    }
  },

  goCheckin(e) {
    const scheduleId = e.currentTarget.dataset.id
    if (!scheduleId) {
      wx.showToast({ title: '课程数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/teacher/checkin/checkin?scheduleId=${scheduleId}` })
  },

  goFeedback(e) {
    const scheduleId = e.currentTarget.dataset.id
    if (!scheduleId) {
      wx.showToast({ title: '课程数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/teacher/feedback/feedback?scheduleId=${scheduleId}` })
  },

  goStudentDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      wx.showToast({ title: '学员数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/teacher/students/detail?id=${id}` })
  },

  goCalendar() {
    wx.switchTab({
      url: '/pages/teacher/calendar/calendar',
      fail: err => {
        console.error('跳转课表失败', err)
        wx.showToast({ title: '课表打开失败，请重试', icon: 'none' })
      }
    })
  },

  goStudents() {
    wx.switchTab({
      url: '/pages/teacher/students/students',
      fail: err => {
        console.error('跳转学员册失败', err)
        wx.showToast({ title: '学员册打开失败，请重试', icon: 'none' })
      }
    })
  }
})
