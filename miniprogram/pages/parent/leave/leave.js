const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const app = getApp()

Page({
  data: {
    loading: true,
    studentId: '',
    studentName: '',
    schedules: [],
    selectedScheduleIndex: -1,
    selectedReasonIndex: 0,
    leaveReasons: constants.LEAVE_REASONS,
    notes: '',
    submitting: false
  },

  onLoad() {
    const userInfo = app.globalData.userInfo
    if (userInfo && userInfo._id) {
      this.setData({
        studentId: userInfo._id,
        studentName: userInfo.name || ''
      })
      this.loadSchedules(userInfo._id)
    } else {
      this.setData({ loading: false })
    }
  },

  async loadSchedules(studentId) {
    this.setData({ loading: true })
    try {
      const today = format.date(new Date())
      const schedules = await api.getSchedules({
        start_time: { $gte: today + ' 00:00' },
        status: 'pending'
      })

      // 筛选属于该学员的排课
      const mySchedules = schedules.filter(s =>
        s.student_ids && s.student_ids.includes(studentId)
      ).slice(0, 20)

      this.setData({ schedules: mySchedules, loading: false })
    } catch (err) {
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
    const { studentId, selectedScheduleIndex, selectedReasonIndex, leaveReasons, notes } = this.data

    if (selectedScheduleIndex < 0) {
      wx.showToast({ title: '请选择请假的课程', icon: 'none' })
      return
    }

    const schedule = this.data.schedules[selectedScheduleIndex]

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
      this.setData({ submitting: false })
    }
  }
})
