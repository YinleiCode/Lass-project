const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const permission = require('../../../utils/permission')
const app = getApp()

Page({
  data: {
    loading: true,
    teacher: null,
    teachers: [],
    auditLogs: [],
    packages: [],
    name: '',
    phone: '',
    isAdmin: false,
    isDev: false,        // 开发版 / 体验版 / 开发者工具
    showDevTools: true,  // 测试阶段老师端固定显示测试工具
    inviteCode: '',
    inviteExpiresAt: '',
    showInviteCode: false,
    showParentSwitchModal: false,
    switchStudents: [],
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
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSelected('/pages/teacher/profile/profile')
    // 检测运行环境(develop=开发版 / trial=体验版 / release=正式版)
    // 真机扫码预览也是 develop 或 trial
    let isDev = false
    try {
      const info = wx.getAccountInfoSync()
      const env = info && info.miniProgram && info.miniProgram.envVersion
      isDev = env === 'develop' || env === 'trial'
    } catch (e) {
      // 部分基础库不支持 getAccountInfoSync,降级:总是允许
      isDev = true
    }
    this.setData({ isDev })
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      if (app.globalData._switchedFromTeacher && app.globalData._originalTeacherInfo) {
        app.globalData.role = 'teacher'
        app.globalData.userInfo = app.globalData._originalTeacherInfo
        app.globalData._switchedFromTeacher = false
        app.globalData._originalTeacherInfo = null
        app.globalData._pendingTabPath = '/pages/teacher/profile/profile'
        app.globalData._roleSwitchVersion = (app.globalData._roleSwitchVersion || 0) + 1
      }
      try {
        await app.checkRole({ ignoreSwitch: true })
      } catch (e) {
        console.error('刷新身份失败', e)
      }
      const userInfo = app.globalData.userInfo
      const teacher = userInfo && app.globalData.role === 'teacher' ? userInfo : null

      const [packages] = await Promise.all([
        // 管理页用 getAllPackages,包含已停用的(否则停用后看不到无法启用)
        api.getAllPackages()
      ])

      const isAdmin = permission.isAdminUser(teacher)
      let teachers = []
      let auditLogs = []
      if (isAdmin) {
        const [teacherRes, logs] = await Promise.all([
          api.getTeachers(),
          api.getStudentAuditLogs(20)
        ])
        teachers = ((teacherRes && teacherRes.data) || []).map(t => ({
          ...t,
          isAdminRole: permission.isAdminUser(t),
          roleText: permission.isAdminUser(t) ? '校长/管理员' : '老师',
          phoneText: t.phone || '未填手机号',
          createdText: format.date(t.created_at) || ''
        }))
        auditLogs = (logs || []).map(log => ({
          ...log,
          actionText: this.formatAuditAction(log.action),
          timeText: format.datetime(log.created_at) || '',
          teacherText: log.teacher_name || '老师',
          studentText: log.student_name || '学员'
        }))
      }
      this.setData({
        teacher,
        teachers,
        auditLogs,
        packages,
        name: teacher ? teacher.name : '',
        phone: teacher ? teacher.phone : '',
        isAdmin,
        showDevTools: isAdmin,
        loading: false
      })
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  formatAuditAction(action) {
    const map = {
      create: '新增',
      update: '修改',
      delete: '删除'
    }
    return map[action] || '操作'
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
    if (this.data.submitting) return
    if (!this.data.name) {
      wx.showToast({ title: '请填写老师姓名', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const result = await api.updateTeacher({
        name: this.data.name,
        phone: this.data.phone
      })
      if (!result || result.success === false) {
        throw new Error((result && result.message) || '保存失败')
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      if (app.globalData.userInfo) {
        app.globalData.userInfo.name = this.data.name
        app.globalData.userInfo.phone = this.data.phone
      }
      this.setData({ submitting: false })
    } catch (err) {
      console.error('保存失败', err)
      this.setData({ submitting: false })
      const msg = (err && (err.message || err.errMsg)) || '保存失败,请重试'
      wx.showToast({ title: msg, icon: 'none' })
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
    if (!this.data.isAdmin) {
      wx.showToast({ title: '仅校长/管理员可测试家长端', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const students = await api.getStudents({})
      if (!students.length) {
        wx.showToast({ title: '没有可模拟的学员', icon: 'none' })
        this.setData({ submitting: false })
        return
      }

      this.setData({
        switchStudents: students,
        showParentSwitchModal: true,
        submitting: false
      })
    } catch (err) {
      console.error('加载模拟学员失败', err)
      wx.showToast({ title: (err && err.message) || '加载学员失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  hideParentSwitchModal() {
    if (this.data.submitting) return
    this.setData({ showParentSwitchModal: false })
  },

  async onSelectParentStudent(e) {
    const index = Number(e.currentTarget.dataset.index)
    const targetStudent = this.data.switchStudents[index]
    if (!targetStudent || !targetStudent._id) {
      wx.showToast({ title: '学员数据异常', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    let previousState = null
    try {
      const confirmRes = await new Promise(resolve => {
        wx.showModal({
          title: '校长测试家长端',
          content: `将临时以「${targetStudent.name}」的家长身份查看页面。普通老师和家长不会拥有这个切换能力。\n\n确定继续吗?`,
          success: r => resolve(r.confirm)
        })
      })
      if (!confirmRes) {
        this.setData({ submitting: false })
        return
      }

      previousState = {
        role: app.globalData.role,
        userInfo: app.globalData.userInfo,
        switchedFromTeacher: app.globalData._switchedFromTeacher,
        originalTeacherInfo: app.globalData._originalTeacherInfo,
        pendingTabPath: app.globalData._pendingTabPath
      }

      // 保存原老师信息 -> 修改 globalData -> reLaunch
      app.globalData._originalTeacherInfo = app.globalData.userInfo
      app.globalData._switchedFromTeacher = true
      app.globalData.role = 'parent'
      app.globalData.userInfo = targetStudent
      app.globalData._pendingTabPath = '/pages/parent/home/home'
      app.globalData._roleSwitchVersion = (app.globalData._roleSwitchVersion || 0) + 1

      this.setData({ showParentSwitchModal: false })
      await new Promise((resolve, reject) => {
        wx.reLaunch({
          url: '/pages/parent/home/home',
          success: resolve,
          fail: reject
        })
      })
      wx.showToast({ title: '已进入家长端', icon: 'success' })
    } catch (err) {
      console.error('切换视角失败', err)
      if (previousState) {
        app.globalData.role = previousState.role
        app.globalData.userInfo = previousState.userInfo
        app.globalData._switchedFromTeacher = previousState.switchedFromTeacher
        app.globalData._originalTeacherInfo = previousState.originalTeacherInfo
        app.globalData._pendingTabPath = previousState.pendingTabPath
      }
      wx.showToast({ title: (err && err.message) || '切换失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  async onAddPackage() {
    if (this.data.submitting) return
    const { pkgName, pkgPrice, pkgDuration, pkgType } = this.data
    const price = Number(pkgPrice)
    const duration = Number(pkgDuration)
    if (!pkgName || !pkgPrice || !pkgDuration) {
      wx.showToast({ title: '请输入完整信息', icon: 'none' })
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      wx.showToast({ title: '请输入有效课时单价', icon: 'none' })
      return
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      wx.showToast({ title: '请输入有效课程时长', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const result = await api.addPackage({
        name: pkgName,
        unit_price: price,
        duration_min: duration,
        type: pkgType
      })

      // 防御:云函数可能返回 success:false,也可能返回 undefined(函数未部署等)
      if (!result || result.success === false) {
        const msg = (result && result.message) || '添加失败,请重试'
        wx.showToast({ title: msg, icon: 'none' })
        this.setData({ submitting: false })
        return
      }

      wx.showToast({ title: '添加成功', icon: 'success' })
      this.hidePackageForm()
      this.loadData()
    } catch (err) {
      console.error('添加套餐失败', err)
      this.setData({ submitting: false })
      // 错误信息透传给用户,不再静默吞掉
      const msg = (err && (err.message || err.errMsg)) || '添加失败,请重试'
      wx.showToast({ title: msg, icon: 'none' })
    }
  }
})
