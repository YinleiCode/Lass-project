const api = require('../../../utils/api')
const format = require('../../../utils/format')
const app = getApp()

Page({
  data: {
    selectedDate: '',
    selectedDateLabel: '', // 预先在 JS 里算好,WXML 不能调用函数
    weekInfo: null,
    schedules: [],
    groupedSchedules: {},
    loading: true,
    showCreateModal: false,
    // 排课表单
    scheduleType: 'once',
    selectedStudents: [],
    packageId: '',
    packageIndex: -1,
    packages: [],
    students: [],
    startDate: '',
    startTime: '',
    classroom: '',
    recurringEnd: '',
    submitting: false
  },

  // 统一更新 selectedDate + selectedDateLabel
  _setSelectedDate(date) {
    this.setData({
      selectedDate: date,
      selectedDateLabel: date ? (format.friendlyDate(date) + ' ' + format.weekday(date)) : ''
    })
  },

  onLoad() {
    const today = format.date(new Date())
    this._setSelectedDate(today)
    this.setData({ startDate: today })
    this.loadWeek(today)
    this.loadFormData()
  },

  onShow() {
    this.loadWeek(this.data.selectedDate)
  },

  async loadWeek(date) {
    this.setData({ loading: true })
    try {
      const weekInfo = format.getWeekRange(date)
      const startStr = weekInfo.start + ' 00:00'
      const endStr = weekInfo.end + ' 23:59'

      const schedules = await api.getSchedules({
        start_time: { $gte: startStr, $lte: endStr }
      })

      // 按日期分组,并预先算好 WXML 需要的字符串(WXML 不能调用函数)
      const grouped = {}
      for (const s of schedules) {
        // 预计算 time_str / status_label
        s.time_str = format.time(s.start_time) || '--:--'
        s.status_label = s.status === 'pending' ? '待上'
          : s.status === 'done' ? '已点名'
          : s.status === 'canceled' ? '已取消'
          : '待上'

        const sDate = s.start_time ? s.start_time.substring(0, 10) : ''
        if (!grouped[sDate]) grouped[sDate] = []
        grouped[sDate].push(s)
      }

      this.setData({
        weekInfo,
        schedules,
        groupedSchedules: grouped,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
    }
  },

  prevWeek() {
    const d = new Date(this.data.selectedDate)
    d.setDate(d.getDate() - 7)
    const date = format.date(d)
    this._setSelectedDate(date)
    this.loadWeek(date)
  },

  nextWeek() {
    const d = new Date(this.data.selectedDate)
    d.setDate(d.getDate() + 7)
    const date = format.date(d)
    this._setSelectedDate(date)
    this.loadWeek(date)
  },

  goToday() {
    const today = format.date(new Date())
    this._setSelectedDate(today)
    this.loadWeek(today)
  },

  selectDay(e) {
    const date = e.currentTarget.dataset.date
    this._setSelectedDate(date)
  },

  // 排课表单
  async loadFormData() {
    try {
      const [students, packages] = await Promise.all([
        api.getStudents({ status: 'active' }),
        api.getPackages()
      ])
      // 给学员补 checked 字段(WXML 不能调用 indexOf,要预先算)
      const studentsWithCheck = students.map(s => ({ ...s, checked: false }))
      this.setData({ students: studentsWithCheck, packages, selectedStudents: [] })
    } catch (e) {
      console.error("操作失败", e)
      wx.showToast({ title: "操作失败", icon: "none" })
    }
  },

  onScheduleTypeChange(e) {
    this.setData({ scheduleType: e.detail.value === '0' ? 'once' : 'recurring' })
  },

  // 切换学员勾选 — 同步更新 students[i].checked 和 selectedStudents 两份数据
  onStudentToggle(e) {
    const id = e.currentTarget.dataset.id
    const students = this.data.students.map(s => {
      if (s._id === id) return { ...s, checked: !s.checked }
      return s
    })
    const selectedStudents = students.filter(s => s.checked).map(s => s._id)
    this.setData({ students, selectedStudents })
  },

  onPackageChange(e) {
    // 防御性判空：picker 可能在 packages 为空、e.detail 缺失、索引越界时崩溃
    const packages = this.data.packages || []
    if (!packages.length) {
      wx.showToast({ title: '请先创建课程包', icon: 'none' })
      return
    }
    const detail = e && e.detail
    const idx = detail && detail.value !== undefined ? Number(detail.value) : -1
    if (isNaN(idx) || idx < 0 || idx >= packages.length) {
      wx.showToast({ title: '请重新选择课程包', icon: 'none' })
      return
    }
    const pkg = packages[idx]
    if (!pkg || !pkg._id) {
      wx.showToast({ title: '课程包数据异常', icon: 'none' })
      return
    }
    this.setData({ packageId: pkg._id, packageIndex: idx })
  },

  onDateChange(e) { this.setData({ startDate: e.detail.value }) },
  onTimeChange(e) { this.setData({ startTime: e.detail.value }) },
  onClassroomInput(e) { this.setData({ classroom: e.detail.value }) },
  onRecurringEndChange(e) { this.setData({ recurringEnd: e.detail.value }) },

  showCreate() {
    this.setData({ showCreateModal: true })
    // 每次打开弹窗都重新拉最新课程包和学员(用户可能在别处刚加完)
    this.loadFormData()
  },

  hideCreate() {
    this.setData({ showCreateModal: false })
  },

  async onCreateSchedule() {
    const { scheduleType, selectedStudents, packageId, startDate, startTime, classroom, recurringEnd } = this.data

    if (!selectedStudents.length || !packageId || !startDate) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const result = await api.createSchedule({
        type: scheduleType,
        studentIds: selectedStudents,
        packageId,
        startTime: `${startDate} ${startTime || '00:00'}`,
        classroom,
        recurringEnd: scheduleType === 'recurring' ? recurringEnd : ''
      })

      if (result && result.success) {
        wx.showToast({ title: '排课成功', icon: 'success' })
        this.hideCreate()
        this.loadWeek(this.data.selectedDate)
      } else {
        wx.showToast({ title: (result && result.message) || '排课失败', icon: 'none' })
      }
    } catch (err) {
      console.error('排课失败', err)
      wx.showToast({ title: (err && err.message) || '排课失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  goCheckin(e) {
    const scheduleId = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/teacher/checkin/checkin?scheduleId=${scheduleId}` })
  },

  goFeedback(e) {
    const scheduleId = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/teacher/feedback/feedback?scheduleId=${scheduleId}` })
  }
})
