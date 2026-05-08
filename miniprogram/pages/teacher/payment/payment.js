const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')

Page({
  data: {
    loading: true,
    studentId: '',
    students: [],
    packages: [],
    selectedStudentIndex: -1,
    selectedPackageIndex: -1,
    courseCount: '',
    amount: '',
    payDate: '',
    payMethod: '微信',
    remark: '',
    payMethods: constants.PAY_METHODS,
    submitting: false,
    previewRemaining: 0
  },

  onLoad(options) {
    const today = format.date(new Date())
    this.setData({ payDate: today })

    if (options.studentId) {
      this.setData({ studentId: options.studentId })
    }

    this.loadFormData()
  },

  async loadFormData() {
    this.setData({ loading: true })
    try {
      const [students, packages] = await Promise.all([
        api.getStudents({}),
        api.getPackages()
      ])

      let selectedStudentIndex = -1
      if (this.data.studentId) {
        selectedStudentIndex = students.findIndex(s => s._id === this.data.studentId)
      }

      this.setData({
        students,
        packages,
        selectedStudentIndex: selectedStudentIndex >= 0 ? selectedStudentIndex : -1,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
    }
  },

  onStudentChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({
      selectedStudentIndex: idx,
      studentId: this.data.students[idx]._id
    })
    this.updatePreview()
  },

  onPackageChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ selectedPackageIndex: idx })
    // 自动计算金额
    const pkg = this.data.packages[idx]
    if (pkg && this.data.courseCount) {
      this.setData({ amount: String(pkg.unit_price * parseInt(this.data.courseCount)) })
    }
    this.updatePreview()
  },

  onCountInput(e) {
    const count = e.detail.value
    this.setData({ courseCount: count })
    if (this.data.selectedPackageIndex >= 0 && count) {
      const pkg = this.data.packages[this.data.selectedPackageIndex]
      this.setData({ amount: String(pkg.unit_price * parseInt(count || 0)) })
    }
    this.updatePreview()
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  onDateChange(e) {
    this.setData({ payDate: e.detail.value })
  },

  onPayMethodChange(e) {
    this.setData({ payMethod: this.data.payMethods[e.detail.value] })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  async updatePreview() {
    const { studentId, courseCount } = this.data
    if (studentId && courseCount) {
      try {
        const balances = await api.getBalance(studentId)
        const totalRemaining = balances.reduce((s, b) => s + (b.remaining || 0), 0)
        this.setData({ previewRemaining: totalRemaining + parseInt(courseCount) })
      } catch (e) {

        console.error("操作失败", e)

        wx.showToast({ title: "操作失败", icon: "none" })

      }

    }
  },

  async onSave() {
    const { studentId, selectedPackageIndex, courseCount, amount, payDate, payMethod, remark, packages } = this.data

    if (!studentId || selectedPackageIndex < 0 || !courseCount || !amount) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认缴费',
      content: `确认登记 ${format.money(parseInt(amount))} 吗？`,
      success: async (res) => {
        if (res.confirm) {
          this.setData({ submitting: true })
          try {
            const result = await api.createOrder({
              studentId,
              packageId: packages[selectedPackageIndex]._id,
              courseCount: parseInt(courseCount),
              amount: parseInt(amount),
              payDate,
              payMethod,
              remark
            })

            if (result.success) {
              wx.showToast({ title: `缴费已登记 +${courseCount}节`, icon: 'success' })
              setTimeout(() => wx.navigateBack(), 1500)
            }
          } catch (err) {
            this.setData({ submitting: false })
          }
        }
      }
    })
  }
})
