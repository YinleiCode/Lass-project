// 云函数调用封装
const api = {
  parentPayload(data = {}) {
    const app = getApp()
    const userInfo = app && app.globalData ? app.globalData.userInfo : null
    if (app && app.globalData && app.globalData._switchedFromTeacher && userInfo && userInfo._id) {
      return { ...data, studentId: userInfo._id }
    }
    return data
  },

  // 通用调用
  call(name, data = {}) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        success: res => {
          if (res.result && res.result.success === false) {
            reject(res.result)
          } else {
            resolve(res.result)
          }
        },
        fail: err => {
          wx.showToast({ title: '网络错误', icon: 'none' })
          reject(err)
        }
      })
    })
  },

  // ===== 学员相关 =====
  getStudents(filter = {}) {
    return this.call('cm_getStudents', { filter }).then(res => (res && res.data) || [])
  },

  getStudent(id) {
    return this.getStudentDetail(id).then(res => (res && res.student) || null)
  },

  getStudentDetail(studentId, options = {}) {
    return this.call('cm_getStudentDetail', { studentId, ...options }).then(res => (res && res.data) || null)
  },

  addStudent(data) {
    return this.call('cm_addStudent', data)
  },

  updateStudent(id, data) {
    return this.call('cm_updateStudent', { studentId: id, data })
  },

  // ===== 课程包 =====
  // 走云函数(管理端身份读取,绕过集合权限,确保云函数写入的数据能读到)
  getPackages() {
    return this.call('cm_getPackages', { activeOnly: true }).then(res => (res && res.data) || [])
  },

  // 获取所有课程包(含已停用,管理用)
  getAllPackages() {
    return this.call('cm_getPackages', { activeOnly: false }).then(res => (res && res.data) || [])
  },

  addPackage(data) {
    return this.call('cm_addPackage', data)
  },

  updatePackage(packageId, data) {
    return this.call('cm_updatePackage', { packageId, data })
  },

  // ===== 缴费 =====
  createOrder(data) {
    return this.call('cm_createOrder', data)
  },

  getOrders(studentId) {
    return this.getStudentDetail(studentId, { feedbackLimit: 1 }).then(res => (res && res.orders) || [])
  },

  getParentOrders() {
    return this.call('cm_getParentData', this.parentPayload({ action: 'orders' })).then(res => (res && res.data) || [])
  },

  // ===== 课时余额 =====
  getBalance(studentId) {
    return this.getStudentDetail(studentId).then(res => (res && res.balances) || [])
  },

  // 批量查询余额 { studentId: totalRemaining, ... }, includePackages=true 时返回 { totals, byPackage }
  batchGetBalance(studentIds, options = {}) {
    return this.call('cm_batchBalance', { studentIds, ...options }).then(res => {
      if (res.success) return res.data
      return options.includePackages ? { totals: {}, byPackage: {} } : {}
    })
  },

  // ===== 排课 =====
  createSchedule(data) {
    return this.call('cm_createSchedule', data)
  },

  // 范围查询排课(走云函数,自动 enrich student_names/package_name/time_str)
  // 兼容旧调用方:仍支持 filter 对象,优先取里面的 start_time 时间范围
  getSchedules(filter = {}) {
    let startDate = ''
    let endDate = ''
    // 兼容旧用法 filter = { start_time: { $gte: '..00:00', $lte: '..23:59' } }
    if (filter && filter.start_time) {
      if (filter.start_time.$gte) startDate = String(filter.start_time.$gte).substring(0, 10)
      if (filter.start_time.$lte) endDate = String(filter.start_time.$lte).substring(0, 10)
    }
    return this.call('cm_getSchedules', { startDate, endDate }).then(res => (res && res.data) || [])
  },

  getParentHome() {
    return this.call('cm_getParentData', this.parentPayload({ action: 'home' })).then(res => (res && res.data) || null)
  },

  getParentProfile() {
    return this.call('cm_getParentData', this.parentPayload({ action: 'profile' })).then(res => (res && res.data) || null)
  },

  getParentSchedules(limit = 20) {
    return this.call('cm_getParentData', this.parentPayload({ action: 'schedules', limit })).then(res => (res && res.data) || [])
  },

  // 单条排课(用于点名/反馈页),返回 enriched schedule 或 null
  getSchedule(scheduleId) {
    return this.call('cm_getSchedules', { scheduleId }).then(res => (res && res.data) || null)
  },

  // ===== 点名 =====
  checkin(data) {
    return this.call('cm_checkin', data)
  },

  undoCheckin(scheduleId) {
    return this.call('cm_undoCheckin', { scheduleId })
  },

  // ===== 反馈 =====
  saveFeedback(data) {
    return this.call('cm_saveFeedback', data)
  },

  getFeedback(scheduleId, studentId) {
    return this.getStudentFeedbacks(studentId, 100)
      .then(feedbacks => feedbacks.find(f => f.schedule_id === scheduleId) || null)
  },

  getParentFeedbackDetail(scheduleId) {
    return this.call('cm_getParentData', this.parentPayload({ action: 'feedbackDetail', scheduleId }))
      .then(res => (res && res.data) || { feedback: null, scheduleInfo: null })
  },

  getStudentFeedbacks(studentId, limit = 20) {
    return this.getStudentDetail(studentId, { feedbackLimit: limit }).then(res => (res && res.feedbacks) || [])
  },

  getParentFeedbacks(limit = 50) {
    return this.call('cm_getParentData', this.parentPayload({ action: 'feedbacks', limit })).then(res => (res && res.data) || [])
  },

  // ===== 统计 =====
  getStats() {
    return this.call('cm_stats')
  },

  // ===== 家长绑定 =====
  bindParent(studentName, parentPhone) {
    return this.call('cm_bindParent', { studentName, parentPhone })
  },

  // ===== 请假 =====
  submitLeave(data) {
    return this.call('cm_submitLeave', data)
  },

  // ===== 老师 =====
  getTeacher() {
    const app = getApp()
    return app.checkRole().then(() => {
      return app.globalData.role === 'teacher' ? app.globalData.userInfo : null
    })
  },

  updateTeacher(data) {
    return this.call('cm_updateTeacher', data)
  },

  getTeachers() {
    return this.call('cm_getTeachers')
  },

  getStudentAuditLogs(limit = 20) {
    return this.call('cm_getStudentAuditLogs', { limit }).then(res => (res && res.data) || [])
  },

  // ===== 删除学员 =====
  deleteStudent(studentId) {
    return this.call('cm_deleteStudent', { studentId })
  }
}

module.exports = api
