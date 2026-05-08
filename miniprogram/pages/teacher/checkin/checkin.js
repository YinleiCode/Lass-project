const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const app = getApp()

Page({
  data: {
    loading: true,
    schedule: null,
    students: [],
    submitting: false,
    undoLoading: false
  },

  onLoad(options) {
    if (options.scheduleId) {
      this.loadData(options.scheduleId)
    }
  },

  async loadData(scheduleId) {
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const scheduleRes = await db.collection('schedules').doc(scheduleId).get()
      const schedule = scheduleRes.data

      const allStudents = await api.getStudents({})
      const enrolledStudents = allStudents.filter(s => schedule.student_ids.includes(s._id))

      // 批量加载余额（替代原来的 N+1 查询）
      const ids = enrolledStudents.map(s => s._id)
      const balanceMap = await api.batchGetBalance(ids)
      for (const s of enrolledStudents) {
        s.remaining = balanceMap[s._id] || 0
        // 初始化点名状态
        s.checkinStatus = 'present'
        s.deductCount = 1
      }

      const deductCount = enrolledStudents.filter(s => s.deductCount > 0).length
      const canUndo = schedule.status === 'done' ? this.canUndo(schedule) : false
      this.setData({
        schedule,
        students: enrolledStudents,
        canUndo,
        deductCount,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
    }
  },

  setStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const students = this.data.students.map(s => {
      if (s._id === id) {
        s.checkinStatus = status
        s.deductCount = status === 'present' ? 1 : (status === 'leave' ? 0 : 1)
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

  async onConfirm() {
    const { schedule, students } = this.data

    wx.showModal({
      title: '确认点名',
      content: `本次点名将扣减 ${students.filter(s => s.deductCount > 0).length} 课时`,
      success: async (res) => {
        if (res.confirm) {
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
              wx.navigateTo({ url: `/pages/teacher/feedback/feedback?scheduleId=${schedule._id}` })
            }
          } catch (err) {
            this.setData({ submitting: false })
          }
        }
      }
    })
  },

  async onUndo() {
    wx.showModal({
      title: '确认撤销',
      content: '撤销后课时将恢复，反馈记录也会删除，确定吗？',
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
