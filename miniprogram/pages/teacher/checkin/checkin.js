const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const app = getApp()

Page({
  data: {
    loading: true,
    schedule: null,
    students: [],
    balanceReady: false,
    showConfirmSheet: false,
    confirmStats: {
      present: 0,
      absent: 0,
      leave: 0,
      deduct: 0
    },
    submitting: false,
    undoLoading: false
  },

  onLoad(options) {
    if (options.scheduleId) {
      this.loadData(options.scheduleId)
    } else {
      wx.showToast({ title: '缺少课程信息', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async loadData(scheduleId) {
    this.setData({ loading: true })
    try {
      // 走云函数读取 — 绕过 schedules 集合权限,确保能读到云函数写入的排课
      const schedule = await api.getSchedule(scheduleId)
      if (!schedule) {
        wx.showToast({ title: '排课不存在或无权访问', icon: 'none' })
        this.setData({ loading: false })
        return
      }

      const allStudents = await api.getStudents({})
      const studentIds = Array.isArray(schedule.student_ids) ? schedule.student_ids : []
      const enrolledStudents = allStudents.filter(s => studentIds.includes(s._id))

      // 批量加载余额（替代原来的 N+1 查询）
      const ids = enrolledStudents.map(s => s._id)
      const balanceResult = await api.batchGetBalance(ids, { includePackages: true })
      const totalBalanceMap = balanceResult.totals || {}
      const balanceByPackage = balanceResult.byPackage || {}
      let hasInvalidBalance = false
      for (const s of enrolledStudents) {
        const packageBalances = balanceByPackage[s._id] || {}
        s.totalRemaining = totalBalanceMap[s._id] || 0
        s.remaining = packageBalances[schedule.package_id] || 0
        s.usableRemaining = s.remaining
        if (s.usableRemaining <= 0) hasInvalidBalance = true
        const hasLeave = Array.isArray(schedule.leave_student_ids) && schedule.leave_student_ids.includes(s._id)
        s.hasLeaveRequest = hasLeave
        s.leaveTag = hasLeave ? '家长已请假' : ''
        s.balanceTag = s.remaining > 0
          ? `本包余 ${s.remaining}节`
          : (s.totalRemaining > 0 ? `本包无余课 · 总余 ${s.totalRemaining}节` : '暂无可扣余课')
        s.checkinStatus = hasLeave || s.usableRemaining <= 0 ? 'leave' : 'present'
        s.deductCount = hasLeave || s.usableRemaining <= 0 ? 0 : 1
      }

      const deductCount = enrolledStudents.filter(s => s.deductCount > 0).length
      const canUndo = schedule.status === 'done' ? this.canUndo(schedule) : false
      this.setData({
        schedule,
        students: enrolledStudents,
        canUndo,
        balanceReady: !hasInvalidBalance,
        deductCount,
        loading: false
      })
    } catch (err) {
      console.error('点名页加载失败', err)
      this.setData({ loading: false })
      const msg = (err && (err.message || err.errMsg)) || '加载失败,请重试'
      wx.showToast({ title: msg, icon: 'none' })
    }
  },

  setStatus(e) {
    if (this.data.submitting || this.data.showConfirmSheet) return
    const { id, status } = e.currentTarget.dataset
    const students = this.data.students.map(s => {
      if (s._id === id) {
        if (status === 'present' && s.usableRemaining <= 0) {
          wx.showToast({ title: `${s.name} 本课程包暂无可扣余课`, icon: 'none' })
          return s
        }
        s.checkinStatus = status
        s.deductCount = status === 'present' ? 1 : 0
      }
      return s
    })
    this.setData({ students })
    this.updateDeductCount()
  },

  updateDeductCount() {
    const count = this.data.students.filter(s => s.deductCount > 0).length
    this.setData({ deductCount: count })
  },

  onConfirm() {
    if (!this.data.schedule || !this.data.schedule._id) {
      wx.showToast({ title: '课程数据不完整', icon: 'none' })
      return
    }
    if (!this.data.students.length) {
      wx.showToast({ title: '暂无可点名学员', icon: 'none' })
      return
    }
    const invalid = this.data.students.find(s => s.checkinStatus === 'present' && s.usableRemaining <= 0)
    if (invalid) {
      wx.showToast({ title: `${invalid.name} 本课程包暂无可扣余课`, icon: 'none' })
      return
    }
    const stats = this.buildConfirmStats()
    this.setData({
      confirmStats: stats,
      showConfirmSheet: true
    })
  },

  hideConfirmSheet() {
    if (this.data.submitting) return
    this.setData({ showConfirmSheet: false })
  },

  buildConfirmStats() {
    const stats = { present: 0, absent: 0, leave: 0, deduct: 0 }
    for (const s of this.data.students) {
      if (s.checkinStatus === 'present') stats.present += 1
      if (s.checkinStatus === 'absent') stats.absent += 1
      if (s.checkinStatus === 'leave') stats.leave += 1
      if (s.deductCount > 0) stats.deduct += s.deductCount
    }
    return stats
  },

  async submitAttendance() {
    if (this.data.submitting) return
    const { schedule, students } = this.data
    if (!schedule || !schedule._id) {
      wx.showToast({ title: '课程数据不完整', icon: 'none' })
      return
    }
    if (!students.length) {
      wx.showToast({ title: '暂无可点名学员', icon: 'none' })
      return
    }
    const invalid = students.find(s => s.checkinStatus === 'present' && s.usableRemaining <= 0)
    if (invalid) {
      wx.showToast({ title: `${invalid.name} 本课程包暂无可扣余课`, icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const result = await api.checkin({
        scheduleId: schedule._id,
        students: students.map(s => ({
          id: s._id,
          status: s.checkinStatus,
          deduct_count: s.deductCount
        }))
      })

      if (result.success) {
        wx.showToast({ title: '点名成功', icon: 'success' })
        this.setData({ showConfirmSheet: false })
        wx.navigateTo({ url: `/pages/teacher/feedback/feedback?scheduleId=${schedule._id}` })
      }
    } catch (err) {
      const msg = (err && (err.message || err.errMsg)) || '点名失败,请重试'
      wx.showToast({ title: msg, icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  async onUndo() {
    if (this.data.undoLoading || this.data.submitting) return
    wx.showModal({
      title: '确认撤销',
      content: '撤销后课时将恢复，已写的课后反馈会保留，确定吗？',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ undoLoading: true })
          try {
            const result = await api.undoCheckin(this.data.schedule._id)
            if (result.success) {
              wx.showToast({ title: '已撤销', icon: 'success' })
              wx.navigateBack()
            }
          } catch (err) {
            wx.showToast({ title: (err && err.message) || '撤销失败，请重试', icon: 'none' })
            this.setData({ undoLoading: false })
          }
        }
      }
    })
  },

  canUndo(schedule) {
    if (!schedule) return false
    const updatedAt = schedule.updated_at || schedule.created_at
    if (!updatedAt) return false
    const diffHours = (new Date() - new Date(updatedAt)) / (1000 * 60 * 60)
    return diffHours <= 24
  }
})
