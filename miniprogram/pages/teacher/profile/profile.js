const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const app = getApp()

Page({
  data: {
    loading: true,
    teacher: null,
    packages: [],
    name: '',
    phone: '',
    isAdmin: false,
    inviteCode: '',
    inviteExpiresAt: '',
    showInviteCode: false,
    // 新增套餐
    showPackageForm: false,
    pkgName: '',
    pkgPrice: '',
    pkgDuration: '45',
    pkgType: '1v1',
    courseTypes: constants.COURSE_TYPES,
    submitting: false,
    format: format,
    constants: constants
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const openid = app.globalData.openid
      const [teacher, packages] = await Promise.all([
        api.getTeacher(openid),
        api.getPackages()
      ])

      this.setData({
        teacher,
        packages,
        name: teacher ? teacher.name : '',
        phone: teacher ? teacher.phone : '',
        isAdmin: teacher ? !!teacher.is_admin : false,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value.trim() }) },
  onPhoneInput(e) { this.setData({ phone: e.detail.value.trim() }) },

  async onSaveTeacher() {
    const openid = app.globalData.openid
    if (!openid) return

    this.setData({ submitting: true })
    try {
      await api.setTeacher({
        openid,
        name: this.data.name,
        phone: this.data.phone
      })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      console.error('保存失败', err)
      this.setData({ submitting: false })
    }
  },

  showPackageForm() {
    this.setData({
      showPackageForm: true,
      pkgName: '',
      pkgPrice: '',
      pkgDuration: '45',
      pkgType: '1v1'
    })
  },

  hidePackageForm() {
    this.setData({ showPackageForm: false })
  },

  onPkgNameInput(e) { this.setData({ pkgName: e.detail.value.trim() }) },
  onPkgPriceInput(e) { this.setData({ pkgPrice: e.detail.value }) },
  onPkgDurationInput(e) { this.setData({ pkgDuration: e.detail.value }) },
  onPkgTypeChange(e) {
    const types = Object.keys(constants.COURSE_TYPES)
    this.setData({ pkgType: types[e.detail.value] })
  },

  async onGenerateInviteCode() {
    this.setData({ submitting: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'cm_generateInviteCode' })
      if (res.result.success) {
        this.setData({
          inviteCode: res.result.code,
          inviteExpiresAt: res.result.expires_at,
          showInviteCode: true
        })
      } else {
        wx.showToast({ title: res.result.message || '生成失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  hideInviteCode() {
    this.setData({ showInviteCode: false })
  },

  async onAddPackage() {
    const { pkgName, pkgPrice, pkgDuration, pkgType } = this.data
    if (!pkgName || !pkgPrice) {
      wx.showToast({ title: '请输入完整信息', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      await api.addPackage({
        name: pkgName,
        unit_price: parseInt(pkgPrice),
        duration_min: parseInt(pkgDuration) || 45,
        type: pkgType
      })
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.hidePackageForm()
      this.loadData()
    } catch (err) {
      console.error('添加套餐失败', err)
      this.setData({ submitting: false })
    }
  }
})
