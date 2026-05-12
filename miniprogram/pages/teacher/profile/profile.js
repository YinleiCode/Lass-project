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
        // 管理页用 getAllPackages,包含已停用的(否则停用后看不到无法启用)
        api.getAllPackages()
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

  // 启用/停用课程包
  async onTogglePackage(e) {
    const { id, active } = e.currentTarget.dataset
    if (!id) return
    const isActive = active === true || active === 'true'
    const nextActive = !isActive
    const action = nextActive ? '启用' : '停用'

    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: `${action}课程包`,
        content: nextActive
          ? '启用后将在缴费、排课时可选'
          : '停用后将不能在缴费、排课时选择(已使用此包的历史数据不受影响)',
        success: r => resolve(r.confirm)
      })
    })
    if (!confirmRes) return

    try {
      await api.updatePackage(id, { is_active: nextActive })
      wx.showToast({ title: `已${action}`, icon: 'success' })
      this.loadData()
    } catch (err) {
      console.error('切换课程包状态失败', err)
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value.trim() }) },
  onPhoneInput(e) { this.setData({ phone: e.detail.value.trim() }) },

  async onSaveTeacher() {
    const openid = app.globalData.openid
    if (!openid) return

    this.setData({ submitting: true })
    try {
      const db = wx.cloud.database()
      await db.collection('teachers').where({ openid }).update({
        data: {
          name: this.data.name,
          phone: this.data.phone,
          updated_at: db.serverDate()
        }
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

  // === 开发者工具: 切换为家长视角 ===
  async onSwitchToParent() {
    try {
      const students = await api.getStudents({ status: 'active' })
      if (!students.length) {
        wx.showToast({ title: '没有可模拟的学员', icon: 'none' })
        return
      }

      // 弹 actionSheet 让管理员选要模拟哪个学员
      const studentNames = students.map(s => s.name || '未命名')
      const tapRes = await new Promise(resolve => {
        wx.showActionSheet({
          itemList: studentNames,
          success: r => resolve(r.tapIndex),
          fail: () => resolve(-1)
        })
      })
      if (tapRes < 0 || tapRes >= students.length) return

      const targetStudent = students[tapRes]
      const confirmRes = await new Promise(resolve => {
        wx.showModal({
          title: '切换为家长视角',
          content: `将以「${targetStudent.name}」的家长身份进入,仅用于测试,冷启动后恢复。\n\n确定继续吗?`,
          success: r => resolve(r.confirm)
        })
      })
      if (!confirmRes) return

      // 保存原老师信息 → 修改 globalData → switchTab
      app.globalData._originalTeacherInfo = app.globalData.userInfo
      app.globalData._switchedFromTeacher = true
      app.globalData.role = 'parent'
      app.globalData.userInfo = targetStudent

      wx.showToast({ title: '已切换为家长视角', icon: 'success' })
      // reLaunch 而不是 switchTab,清空页面栈,确保 tab-bar 实例彻底重建
      // (switchTab 在自定义 tabBar 时可能复用旧的 tab-bar 实例,导致 tabs 不刷新)
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/parent/home/home' })
      }, 600)
    } catch (err) {
      console.error('切换视角失败', err)
      wx.showToast({ title: '切换失败', icon: 'none' })
    }
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
