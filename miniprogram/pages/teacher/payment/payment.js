const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const permission = require('../../../utils/permission')

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
    currentRemaining: 0,
    previewRemaining: 0,
    totalPaid: 0,
    totalPaidText: '¥0',
    previewTotalPaid: 0,
    previewTotalPaidText: '¥0',
    isAdmin: false,
    accessDenied: false
  },

  calcAmount(unitPrice, count) {
    const price = Number(unitPrice)
    const countValue = Number(count)
    if (!Number.isFinite(price) || !Number.isFinite(countValue)) return ''
    return String(parseFloat((price * countValue).toFixed(2)))
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '课程登记' })
    const today = format.date(new Date())
    this.setData({ payDate: today })

    if (options.studentId) {
      this.setData({ studentId: options.studentId })
    }

    this.loadFormData()
  },

  async loadFormData() {
    this.setData({ loading: true, accessDenied: false })
    try {
      const app = getApp()
      try {
        await app.checkRole()
      } catch (e) {
        console.error('刷新身份失败', e)
      }
      const isAdmin = permission.isAdminUser(app.globalData.userInfo)
      if (!isAdmin) {
        wx.showToast({ title: '仅校长/管理员可操作', icon: 'none' })
        this.setData({ loading: false, isAdmin: false, accessDenied: true })
        setTimeout(() => wx.navigateBack(), 900)
        return
      }
      wx.setNavigationBarTitle({ title: '登记缴费' })

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
        isAdmin,
        accessDenied: false,
        selectedStudentIndex: selectedStudentIndex >= 0 ? selectedStudentIndex : -1,
        loading: false
      })
      if (selectedStudentIndex >= 0) {
        this.updatePreview()
      }
    } catch (err) {
      console.error('缴费表单加载失败', err)
      wx.showToast({ title: (err && err.message) || '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onStudentChange(e) {
    const idx = parseInt(e.detail.value)
    if (!this.data.students[idx]) {
      wx.showToast({ title: '请重新选择学员', icon: 'none' })
      return
    }
    this.setData({
      selectedStudentIndex: idx,
      studentId: this.data.students[idx]._id
    })
    this.updatePreview()
  },

  onPackageChange(e) {
    const idx = parseInt(e.detail.value)
    if (!this.data.packages[idx]) {
      wx.showToast({ title: '请重新选择课程包', icon: 'none' })
      return
    }
    this.setData({ selectedPackageIndex: idx })
    // 自动计算金额
    const pkg = this.data.packages[idx]
    if (pkg && this.data.courseCount) {
      this.setData({ amount: this.calcAmount(pkg.unit_price, this.data.courseCount) })
    }
    this.updatePreview()
  },

  onCountInput(e) {
    const count = e.detail.value
    this.setData({ courseCount: count })
    if (this.data.selectedPackageIndex >= 0 && count) {
      const pkg = this.data.packages[this.data.selectedPackageIndex]
      const amount = this.calcAmount(pkg && pkg.unit_price, count)
      if (amount) this.setData({ amount })
    }
    this.updatePreview()
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
    this.updatePreview()
  },

  onDateChange(e) {
    this.setData({ payDate: e.detail.value })
  },

  onPayMethodChange(e) {
    const idx = Number(e.detail.value)
    const method = this.data.payMethods[idx]
    if (!method) {
      wx.showToast({ title: '请重新选择支付方式', icon: 'none' })
      return
    }
    this.setData({ payMethod: method })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  async updatePreview() {
    const { studentId, courseCount, amount } = this.data
    if (!studentId) {
      this.setData({
        currentRemaining: 0,
        previewRemaining: 0,
        totalPaid: 0,
        totalPaidText: '¥0',
        previewTotalPaid: 0,
        previewTotalPaidText: '¥0'
      })
      return
    }

    try {
      const detail = await api.getStudentDetail(studentId)
      const balances = detail && detail.balances ? detail.balances : []
      const orders = detail && detail.orders ? detail.orders : []
      const currentRemaining = balances.reduce((s, b) => s + (b.remaining || 0), 0)
      const totalPaid = orders.reduce((s, o) => s + (o.amount || 0), 0)
      const addCount = parseInt(courseCount || 0)
      const addAmount = parseInt(amount || 0)
      this.setData({
        currentRemaining,
        totalPaid,
        totalPaidText: format.money(totalPaid),
        previewRemaining: currentRemaining + (Number.isFinite(addCount) ? addCount : 0),
        previewTotalPaid: totalPaid + (Number.isFinite(addAmount) ? addAmount : 0),
        previewTotalPaidText: format.money(totalPaid + (Number.isFinite(addAmount) ? addAmount : 0))
      })
    } catch (e) {
      console.error('缴费预览加载失败', e)
      wx.showToast({ title: (e && e.message) || '预览加载失败', icon: 'none' })
    }
  },

  async onSave() {
    if (this.data.submitting) return
    if (!this.data.isAdmin) {
      wx.showToast({ title: '仅校长/管理员可操作', icon: 'none' })
      return
    }
    const { studentId, selectedPackageIndex, courseCount, amount, payDate, payMethod, remark, packages } = this.data

    if (!studentId || selectedPackageIndex < 0 || !courseCount || !amount) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    const courseCountValue = Number(courseCount)
    const amountValue = Number(amount)
    if (!Number.isFinite(courseCountValue) || courseCountValue <= 0) {
      wx.showToast({ title: '课时数需大于0', icon: 'none' })
      return
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      wx.showToast({ title: '金额需大于0', icon: 'none' })
      return
    }
    if (!packages[selectedPackageIndex] || !packages[selectedPackageIndex]._id) {
      wx.showToast({ title: '课程包数据异常', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认缴费',
      content: `确认登记 ${format.money(amountValue)} 吗？`,
      success: async (res) => {
        if (res.confirm) {
          if (this.data.submitting) return
          this.setData({ submitting: true })
          try {
            const result = await api.createOrder({
              studentId,
              packageId: packages[selectedPackageIndex]._id,
              courseCount: courseCountValue,
              amount: amountValue,
              payDate,
              payMethod,
              remark
            })

            if (result.success) {
              wx.showToast({ title: `缴费已登记 +${courseCount}节`, icon: 'success' })
              await this.updatePreview()
              setTimeout(() => wx.navigateBack(), 1500)
            }
          } catch (err) {
            const msg = (err && (err.message || err.errMsg)) || '缴费失败，请重试'
            wx.showToast({ title: msg, icon: 'none' })
            this.setData({ submitting: false })
          }
        }
      }
    })
  }
})
