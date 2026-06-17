const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')

Page({
  data: {
    loading: true,
    student: null,
    balances: [],
    orders: [],
    feedbacks: [],
    avatarText: '?',
    studentName: '',
    studentPhone: '',
    enrollDateText: '',
    statusClass: '',
    statusText: '',
    totalAttended: 0,
    totalPaid: 0,
    totalPaidText: '¥0',
    isAdmin: false,
    ownerTeacherText: '',
    accessTeacherText: '',
    totalFeedbackCount: 0,
    totalRemaining: 0,
    format: format
  },

  onLoad(options) {
    if (options.id) {
      this.loadData(options.id)
    }
  },

  async loadData(id) {
    this.setData({ loading: true })
    try {
      const detail = await api.getStudentDetail(id)
      if (!detail) throw new Error('学员不存在或无权访问')
      const { student, balances, orders, feedbacks, isAdmin } = detail

      const canViewMoney = !!isAdmin
      const totalPaid = canViewMoney ? orders.reduce((sum, o) => sum + (o.amount || 0), 0) : 0
      const displayBalances = (balances || []).map(b => ({
        ...b,
        packageNameText: b.package_name || '课程包',
        remainingText: `${b.remaining || 0}节`,
        balanceClass: (b.remaining || 0) <= 3 ? 'danger' : ((b.remaining || 0) <= 5 ? 'warning' : ''),
        detailText: `总课时 ${b.total_purchased || 0} · 已用 ${b.total_used || 0}`
      }))
      const displayOrders = (orders || []).slice(0, 5).map(o => ({
        ...o,
        amountText: format.money(o.amount || 0),
        payDateText: o.pay_date || format.date(o.created_at) || '',
        courseCountText: `+${o.course_count || 0}节`
      }))
      const displayFeedbacks = (feedbacks || []).map(f => {
        const comment = f.comment ? String(f.comment) : ''
        return {
          ...f,
          dateText: format.datetime(f.created_at) || '',
          scheduleId: f.schedule_id || '',
          commentPreview: comment ? (comment.length > 30 ? comment.substring(0, 30) + '...' : comment) : '无评语'
        }
      })
      const totalRemaining = displayBalances.reduce((sum, b) => sum + (b.remaining || 0), 0)
      const studentName = student && student.name ? student.name : '学员'
      const accessNames = Array.isArray(student.access_teacher_names) ? student.access_teacher_names.filter(Boolean) : []
      const ownerTeacherText = student && student.owner_teacher_name ? `负责老师：${student.owner_teacher_name}` : ''
      const accessTeacherText = accessNames.length ? `可授课老师：${accessNames.join(' / ')}` : ''

      this.setData({
        student,
        avatarText: studentName.substring(0, 1) || '?',
        studentName,
        studentPhone: student && student.parent_phone ? student.parent_phone : '',
        enrollDateText: student && student.enroll_date ? `入学 ${student.enroll_date}` : '',
        statusClass: student && student.status === 'active' ? 'active' : 'archived',
        statusText: student && student.status === 'active' ? '在读' : '结业',
        totalAttended: student && student.total_attended ? student.total_attended : 0,
        balances: displayBalances,
        orders: canViewMoney ? displayOrders : [],
        feedbacks: displayFeedbacks,
        isAdmin: canViewMoney,
        ownerTeacherText,
        accessTeacherText,
        totalPaid,
        totalPaidText: format.money(totalPaid),
        totalFeedbackCount: feedbacks.length,
        totalRemaining,
        loading: false
      })
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  goPayment() {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '仅校长/管理员可操作', icon: 'none' })
      return
    }
    if (!this.data.student || !this.data.student._id) {
      wx.showToast({ title: '学员数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/teacher/payment/payment?studentId=${this.data.student._id}` })
  },

  goEdit() {
    if (!this.data.student || !this.data.student._id) {
      wx.showToast({ title: '学员数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/teacher/students/add?id=${this.data.student._id}` })
  },

  goAllOrders() {
    if (!this.data.isAdmin) return
    if (!this.data.student || !this.data.student._id) {
      wx.showToast({ title: '学员数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/parent/payment-list/payment-list?studentId=${this.data.student._id}&teacher=1` })
  },

  goAllFeedbacks() {
    if (!this.data.student || !this.data.student._id) {
      wx.showToast({ title: '学员数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/teacher/students/feedbacks?studentId=${this.data.student._id}` })
  },

  goFeedback(e) {
    const { scheduleid } = e.currentTarget.dataset
    const studentId = this.data.student && this.data.student._id
    if (!scheduleid || !studentId) {
      wx.showToast({ title: '回声数据不完整', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/teacher/feedback/feedback?scheduleId=${scheduleid}&studentId=${studentId}` })
  }
})
