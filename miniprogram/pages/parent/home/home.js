const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const role = require('../../../utils/role')
const app = getApp()

function openTabLike(url) {
  wx.reLaunch({ url })
}

Page({
  data: {
    loading: true,
    student: null,
    balances: [],
    totalRemaining: 0,
    totalAttended: 0,
    studentName: '',
    avatarText: '?',
    balanceCards: [],
    hasBalances: false,
    upcomingSchedules: [],
    latestFeedback: null,
    latestFeedbackDateText: '',
    latestFeedbackPreview: '',
    hasAudio: false,
    format: format
  },

  async onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSelected('/pages/parent/home/home')
    const ok = await role.ensureParentAccess()
    if (!ok) {
      this.setData({ loading: false })
      return
    }
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const data = await api.getParentHome()
      if (!data) throw new Error('未找到家长数据')
      const { student, balances, totalRemaining, upcomingSchedules, latestFeedback } = data
      const safeStudent = student || {}
      const safeName = safeStudent.name || '学员'
      const safeSchedules = (upcomingSchedules || []).map(s => ({
        ...s,
        startTimeText: format.datetime(s.start_time) || s.start_time || '',
        classroomText: s.classroom || '',
        metaText: [s.class_display || s.class_type_label, s.duration_text, s.delivery_mode_label].filter(Boolean).join(' · '),
        teacherText: s.teacher_name ? `授课老师：${s.teacher_name}` : ''
      }))
      const balanceCards = (balances || []).map(b => {
        const remaining = Number(b.remaining || 0)
        const totalUsed = Number(b.total_used || 0)
        const totalPurchased = Number(b.total_purchased || 0)
        return {
          ...b,
          packageNameText: b.package_name || '课程包',
          remainingText: `${remaining}节`,
          usedText: `${totalUsed}节`,
          purchasedText: `${totalPurchased}节`,
          warningClass: remaining <= 3 ? 'danger' : (remaining <= 5 ? 'warning' : '')
        }
      })
      const comment = latestFeedback && latestFeedback.comment ? String(latestFeedback.comment) : ''

      this.setData({
        student: safeStudent,
        studentName: safeName,
        avatarText: safeName.substring(0, 1) || '?',
        balances,
        balanceCards,
        hasBalances: balanceCards.length > 0,
        totalRemaining: totalRemaining || 0,
        totalAttended: safeStudent.total_attended || 0,
        upcomingSchedules: safeSchedules,
        latestFeedback,
        latestFeedbackDateText: latestFeedback ? (format.datetime(latestFeedback.created_at) || '') : '',
        latestFeedbackPreview: comment ? (comment.length > 80 ? comment.substring(0, 80) + '...' : comment) : '暂无文字评语',
        hasAudio: latestFeedback && latestFeedback.audio_files && latestFeedback.audio_files.length > 0,
        loading: false
      })
    } catch (err) {
      console.error('家长首页加载失败', err)
      wx.showToast({ title: (err && err.message) || '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  goRecords() {
    openTabLike('/pages/parent/records/records')
  },

  goLeave() {
    wx.navigateTo({ url: '/pages/parent/leave/leave' })
  },

  goPaymentList() {
    wx.showToast({ title: '请联系老师了解课程安排', icon: 'none' })
  },

  goFeedbackDetail() {
    const feedback = this.data.latestFeedback
    if (!feedback) {
      wx.showToast({ title: '暂无课后回声', icon: 'none' })
      return
    }
    const scheduleId = feedback.schedule_id || ''
    if (!scheduleId) {
      wx.showToast({ title: '回声数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/parent/feedback-detail/feedback-detail?scheduleId=${scheduleId}`
    })
  }
})
