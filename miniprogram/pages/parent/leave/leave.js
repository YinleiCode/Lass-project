const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const role = require('../../../utils/role')
const app = getApp()

Page({
  data: {
    loading: true,
    studentId: '',
    studentName: '',
    schedules: [],
    hasSchedules: false,
    selectedScheduleIndex: -1,
    selectedReasonIndex: 0,
    leaveReasons: constants.LEAVE_REASONS,
    notes: '',
    submitting: false
  },

  async onLoad() {
    const ok = await role.ensureParentAccess()
    if (!ok) {
      this.setData({ loading: false })
      return
    }
    const userInfo = app.globalData.userInfo
    if (userInfo && userInfo._id) {
      this.setData({
        studentId: userInfo._id,
        studentName: userInfo.name || ''
      })
      this.loadSchedules()
    } else {
      this.setData({ loading: false })
    }
  },

  async loadSchedules() {
    this.setData({ loading: true })
    try {
      const schedules = await api.getParentSchedules(20)
      const displaySchedules = schedules.map(s => ({
        ...s,
        labelText: `${format.datetime(s.start_time) || s.start_time || ''}${s.package_name ? ' · ' + s.package_name : ''}`,
        classroomText: s.classroom || ''
      }))
      this.setData({
        schedules: displaySchedules,
        hasSchedules: displaySchedules.length > 0,
        loading: false
      })
    } catch (err) {
      console.error('请假课程加载失败', err)
      wx.showToast({ title: '课程加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onScheduleChange(e) {
    this.setData({ selectedScheduleIndex: parseInt(e.detail.value) })
  },

  onReasonChange(e) {
    this.setData({ selectedReasonIndex: parseInt(e.detail.value) })
  },

  onNotesInput(e) {
    this.setData({ notes: e.detail.value })
  },

  async onSubmit() {
    if (this.data.submitting) return
    const { studentId, selectedScheduleIndex, selectedReasonIndex, leaveReasons, notes } = this.data

    if (!studentId) {
      wx.showToast({ title: '缺少学员信息', icon: 'none' })
      return
    }
    if (selectedScheduleIndex < 0) {
      wx.showToast({ title: '请选择请假的课程', icon: 'none' })
      return
    }

    const schedule = this.data.schedules[selectedScheduleIndex]
    if (!schedule || !schedule._id) {
      wx.showToast({ title: '课程数据不完整', icon: 'none' })
      return
    }
    if (!leaveReasons[selectedReasonIndex]) {
      wx.showToast({ title: '请选择请假原因', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      await api.submitLeave({
        student_id: studentId,
        schedule_id: schedule._id,
        schedule_time: schedule.start_time,
        reason: leaveReasons[selectedReasonIndex],
        notes: notes,
        status: 'pending'
      })

      wx.showToast({ title: '请假已提交', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      console.error('提交请假失败', err)
      wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  }
})
