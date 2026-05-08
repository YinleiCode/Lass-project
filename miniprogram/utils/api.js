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
            wx.showToast({ title: res.result.message || '操作失败', icon: 'none' })
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
    const db = wx.cloud.database()
    data.total_attended = 0
    data.status = 'active'
    data.created_at = db.serverDate()
    data.updated_at = db.serverDate()
    return db.collection('students').add({ data })
  },

  updateStudent(id, data) {
    const db = wx.cloud.database()
    data.updated_at = db.serverDate()
    return db.collection('students').doc(id).update({ data })
  },

  // ===== 课程包 =====
  getPackages() {
    const db = wx.cloud.database()
    return db.collection('course_packages').where({ is_active: true }).get().then(res => res.data)
  },

  addPackage(data) {
    const db = wx.cloud.database()
    data.is_active = true
    data.created_at = db.serverDate()
    return db.collection('course_packages').add({ data })
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

  getSchedules(filter = {}) {
    const db = wx.cloud.database()
    return db.collection('schedules').where(filter)
      .orderBy('start_time', 'asc').get().then(res => res.data)
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
    const db = wx.cloud.database()
    // 先查是否已有
    return db.collection('feedbacks').where({
      schedule_id: data.schedule_id,
      student_id: data.student_id
    }).get().then(res => {
      if (res.data.length > 0) {
        return db.collection('feedbacks').doc(res.data[0]._id).update({
          data: { ...data, updated_at: db.serverDate() }
        })
      } else {
        return db.collection('feedbacks').add({
          data: { ...data, created_at: db.serverDate(), updated_at: db.serverDate() }
        })
      }
    })
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
    const db = wx.cloud.database()
    data.created_at = db.serverDate()
    return db.collection('leaves').add({ data })
  },

  // ===== 老师 =====
  getTeacher(openid) {
    const db = wx.cloud.database()
    return db.collection('teachers').where({ openid }).get().then(res => res.data[0] || null)
  },

  setTeacher(data) {
    const db = wx.cloud.database()
    data.updated_at = db.serverDate()
    return db.collection('teachers').where({ openid: data.openid }).get().then(res => {
      if (res.data.length > 0) {
        return db.collection('teachers').doc(res.data[0]._id).update({ data })
      } else {
        data.created_at = db.serverDate()
        return db.collection('teachers').add({ data })
      }
    })
  },

  // ===== 删除学员 =====
  deleteStudent(studentId) {
    return this.call('cm_deleteStudent', { studentId })
  }
}

module.exports = api
