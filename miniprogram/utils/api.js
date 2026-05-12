// 云函数调用封装
const api = {
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
    const db = wx.cloud.database()
    let query = db.collection('students').where(filter)
    return query.orderBy('created_at', 'desc').get().then(res => res.data)
  },

  getStudent(id) {
    const db = wx.cloud.database()
    return db.collection('students').doc(id).get().then(res => res.data)
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
    const db = wx.cloud.database()
    return db.collection('orders').where({
      student_id: studentId
    }).orderBy('created_at', 'desc').get().then(res => res.data)
  },

  // ===== 课时余额 =====
  getBalance(studentId) {
    const db = wx.cloud.database()
    return db.collection('course_balance').where({
      student_id: studentId
    }).get().then(res => res.data)
  },

  // 批量查询余额 { studentId: totalRemaining, ... }
  batchGetBalance(studentIds) {
    return this.call('cm_batchBalance', { studentIds }).then(res => {
      if (res.success) return res.data
      return {}
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
    const db = wx.cloud.database()
    return db.collection('feedbacks').where({
      schedule_id: scheduleId,
      student_id: studentId
    }).get().then(res => res.data[0] || null)
  },

  getStudentFeedbacks(studentId, limit = 20) {
    const db = wx.cloud.database()
    return db.collection('feedbacks').where({
      student_id: studentId
    }).orderBy('created_at', 'desc').limit(limit).get().then(res => res.data)
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
  getTeacher(openid) {
    const db = wx.cloud.database()
    return db.collection('teachers').where({ openid }).get().then(res => res.data[0] || null)
  },

  // ===== 删除学员 =====
  deleteStudent(studentId) {
    return this.call('cm_deleteStudent', { studentId })
  }
}

module.exports = api
