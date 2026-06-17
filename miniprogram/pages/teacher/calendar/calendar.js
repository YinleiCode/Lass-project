const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
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
    allPackages: [],
    balanceTotals: {},
    balanceByPackage: {},
    paidByPackage: {},
    packageHint: '先选择学员，再选择有余课的课程包',
    students: [],
    scheduleClassTypes: constants.SCHEDULE_CLASS_TYPE_OPTIONS,
    classType: 'one_to_one',
    classTypeIndex: 0,
    classTypeLabel: constants.SCHEDULE_CLASS_TYPES.one_to_one,
    deliveryModes: constants.DELIVERY_MODE_OPTIONS,
    deliveryMode: 'offline',
    deliveryModeIndex: 0,
    deliveryModeLabel: constants.DELIVERY_MODES.offline,
    teachers: [],
    teacherId: '',
    teacherIndex: -1,
    teacherName: '',
    isAdmin: false,
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

  getCurrentMinute() {
    const now = new Date()
    return {
      date: format.date(now),
      time: format.time(now),
      value: now.getHours() * 60 + now.getMinutes()
    }
  },

  timeToMinute(time) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(time || ''))
    if (!match) return -1
    return Number(match[1]) * 60 + Number(match[2])
  },

  onLoad() {
    const today = format.date(new Date())
    this._setSelectedDate(today)
    this.setData({ startDate: today })
    this.loadWeek(today)
    this.loadFormData()
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSelected('/pages/teacher/calendar/calendar')
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
          : s.status === 'cancelled' ? '已取消'
          : '待上'
        if (s.status === 'pending' && s.has_leave) {
          s.status_label = `请假${s.leave_count || 0}人`
        }

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
      wx.showToast({ title: (err && err.message) || '课表加载失败，请重试', icon: 'none' })
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
  getAvailablePackages(selectedStudents, allPackages, balanceByPackage) {
    if (!selectedStudents.length) return []
    return (allPackages || []).map(pkg => {
      if (!pkg || !pkg._id) return false
      const packageActive = pkg.is_active !== false
      const states = selectedStudents.map(studentId => {
        const packageBalances = balanceByPackage[studentId] || {}
        const packageRemaining = Number(packageBalances[pkg._id] || 0)
        return {
          studentId,
          packageRemaining,
          usable: packageRemaining > 0
        }
      })
      if (!states.every(item => item.usable)) return null
      const minPackageRemaining = states.reduce((min, item) => Math.min(min, item.packageRemaining), Infinity)
      const remainingText = selectedStudents.length > 1 ? `共同余课 ${minPackageRemaining}节` : `余课 ${minPackageRemaining}节`
      return {
        ...pkg,
        displayName: `${pkg.name} · ${remainingText}${packageActive ? '' : ' · 余课消耗'}`,
        balanceMode: 'package'
      }
    }).filter(Boolean)
  },

  updateAvailablePackages(selectedStudents = this.data.selectedStudents) {
    const packages = this.getAvailablePackages(
      selectedStudents,
      this.data.allPackages,
      this.data.balanceByPackage
    )
    const currentIndex = packages.findIndex(pkg => pkg._id === this.data.packageId)
    const nextIndex = currentIndex >= 0 ? currentIndex : (packages.length === 1 ? 0 : -1)
    let packageHint = '先选择学员，再选择有余课的课程包'
    if (selectedStudents.length && packages.length) {
      packageHint = '只显示该课程包已缴费且仍有余课的选项'
    } else if (selectedStudents.length && packages.length === 0) {
      packageHint = this.data.isAdmin
        ? '所选学员暂无可排课程包，请先登记缴费'
        : '所选学员暂无可排课程包，请联系管理员补课时'
    }
    this.setData({
      packages,
      packageHint,
      packageId: nextIndex >= 0 ? packages[nextIndex]._id : '',
      packageIndex: nextIndex
    })
  },

  async loadFormData() {
    try {
      const [students, packages, teacherRes] = await Promise.all([
        api.getStudents({ status: 'active' }),
        api.getAllPackages(),
        api.getTeachers()
      ])
      const teachers = (teacherRes && teacherRes.data) || []
      const currentTeacherId = teacherRes && teacherRes.currentTeacherId
      const teacherIndex = teachers.findIndex(t => t._id === (this.data.teacherId || currentTeacherId))
      const nextTeacherIndex = teacherIndex >= 0 ? teacherIndex : (teachers.length ? 0 : -1)
      const selectedTeacher = nextTeacherIndex >= 0 ? teachers[nextTeacherIndex] : null
      const studentIds = students.map(s => s._id).filter(Boolean)
      const balanceResult = await api.batchGetBalance(studentIds, { includePackages: true })
      const totals = balanceResult.totals || {}
      const balanceByPackage = balanceResult.byPackage || {}
      const paidByPackage = balanceResult.paidByPackage || {}
      // 给学员补 checked 字段(WXML 不能调用 indexOf,要预先算)
      const studentsWithCheck = students.map(s => ({
        ...s,
        checked: false,
        remaining: totals[s._id] || 0
      }))
      this.setData({
        students: studentsWithCheck,
        allPackages: packages,
        packages: [],
        teachers,
        isAdmin: !!(teacherRes && teacherRes.isAdmin),
        teacherId: selectedTeacher ? selectedTeacher._id : '',
        teacherIndex: nextTeacherIndex,
        teacherName: selectedTeacher ? selectedTeacher.name : '',
        balanceTotals: totals,
        balanceByPackage,
        paidByPackage,
        selectedStudents: [],
        packageId: '',
        packageIndex: -1,
        packageHint: '先选择学员，再选择有余课的课程包'
      })
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
    if (this.data.submitting) return
    const id = e.currentTarget.dataset.id
    const students = this.data.students.map(s => {
      if (s._id === id) return { ...s, checked: !s.checked }
      return s
    })
    const selectedStudents = students.filter(s => s.checked).map(s => s._id)
    this.setData({ students, selectedStudents })
    this.updateAvailablePackages(selectedStudents)
  },

  onPackageChange(e) {
    // 防御性判空：picker 可能在 packages 为空、e.detail 缺失、索引越界时崩溃
    const packages = this.data.packages || []
    if (!packages.length) {
      wx.showToast({
        title: this.data.isAdmin ? '请先创建课程包' : '请联系管理员配置课程包',
        icon: 'none'
      })
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

  onClassTypeChange(e) {
    const idx = Number(e.detail.value)
    const option = this.data.scheduleClassTypes[idx]
    if (!option) {
      wx.showToast({ title: '请重新选择班型', icon: 'none' })
      return
    }
    this.setData({
      classType: option.value,
      classTypeIndex: idx,
      classTypeLabel: option.label
    })
  },

  onDeliveryModeChange(e) {
    const idx = Number(e.detail.value)
    const option = this.data.deliveryModes[idx]
    if (!option) {
      wx.showToast({ title: '请重新选择上课方式', icon: 'none' })
      return
    }
    this.setData({
      deliveryMode: option.value,
      deliveryModeIndex: idx,
      deliveryModeLabel: option.label
    })
  },

  onTeacherChange(e) {
    const idx = Number(e.detail.value)
    const teacher = this.data.teachers[idx]
    if (!teacher || !teacher._id) {
      wx.showToast({ title: '请重新选择授课老师', icon: 'none' })
      return
    }
    this.setData({
      teacherId: teacher._id,
      teacherIndex: idx,
      teacherName: teacher.name || '授课老师'
    })
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
    if (this.data.submitting) return
    this.setData({ showCreateModal: false })
  },

  async onCreateSchedule() {
    if (this.data.submitting) return
    const {
      scheduleType,
      selectedStudents,
      packageId,
      packages,
      classType,
      deliveryMode,
      teacherId,
      startDate,
      startTime,
      classroom,
      recurringEnd
    } = this.data

    if (!selectedStudents.length) {
      wx.showToast({ title: '请选择学员', icon: 'none' })
      return
    }
    if (!packages.length) {
      wx.showToast({
        title: this.data.isAdmin ? '所选学员暂无可排课程包' : '该学员暂无可排课程包，请联系管理员',
        icon: 'none'
      })
      return
    }
    if (!packageId) {
      wx.showToast({ title: '请选择课程包', icon: 'none' })
      return
    }
    if (!classType) {
      wx.showToast({ title: '请选择班型', icon: 'none' })
      return
    }
    if (!deliveryMode) {
      wx.showToast({ title: '请选择上课方式', icon: 'none' })
      return
    }
    if (!teacherId) {
      wx.showToast({ title: '请选择授课老师', icon: 'none' })
      return
    }
    if (!startDate) {
      wx.showToast({ title: '请选择开始日期', icon: 'none' })
      return
    }
    const nowMinute = this.getCurrentMinute()
    const finalStartTime = startTime || (startDate === nowMinute.date ? nowMinute.time : '00:00')
    if (startDate < nowMinute.date || (startDate === nowMinute.date && this.timeToMinute(finalStartTime) < nowMinute.value)) {
      wx.showToast({ title: '不能排到已过去的时间', icon: 'none' })
      return
    }
    if (scheduleType === 'recurring' && !recurringEnd) {
      wx.showToast({ title: '请选择截止日期', icon: 'none' })
      return
    }
    if (scheduleType === 'recurring' && recurringEnd < startDate) {
      wx.showToast({ title: '截止日期不能早于开始日期', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const result = await api.createSchedule({
        type: scheduleType,
        studentIds: selectedStudents,
        packageId,
        classType,
        deliveryMode,
        teacherId,
        startTime: `${startDate} ${finalStartTime}`,
        classroom,
        recurringEnd: scheduleType === 'recurring' ? recurringEnd : ''
      })

      if (result && result.success) {
        wx.showToast({ title: result.message || '排课成功', icon: result.truncated ? 'none' : 'success' })
        this.setData({ showCreateModal: false })
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
  }
})
