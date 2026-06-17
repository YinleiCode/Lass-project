const api = require('../../../utils/api')
const format = require('../../../utils/format')
const permission = require('../../../utils/permission')
const app = getApp()

Page({
  data: {
    loading: true,
    students: [],
    filteredStudents: [],
    searchKeyword: '',
    activeTag: '',
    allTags: [],
    stats: { active: 0, archived: 0 },
    isAdmin: false
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setSelected('/pages/teacher/students/students')
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const students = await api.getStudents({})
      const app = getApp()
      const isAdmin = permission.isAdminUser(app.globalData.userInfo)
      const tags = new Set()
      let active = 0
      let archived = 0
      for (const s of students) {
        if (s.status === 'active') active++
        else archived++
        if (s.tags) s.tags.forEach(t => tags.add(t))
      }

      // 批量加载余额（替代原来的 N+1 查询）
      const ids = students.map(s => s._id)
      const balanceMap = await api.batchGetBalance(ids)
      for (const s of students) {
        s.ownerText = s.owner_teacher_name ? `负责老师：${s.owner_teacher_name}` : ''
        s.remaining = balanceMap[s._id] || 0
      }

      this.setData({
        students,
        filteredStudents: students,
        allTags: [...tags],
        isAdmin,
        stats: { active, archived },
        loading: false
      })
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '学员加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
    wx.stopPullDownRefresh()
  },

  onSearchInput(e) {
    const keyword = e.detail.value.trim().toLowerCase()
    this.setData({ searchKeyword: keyword })
    this.filterStudents()
  },

  filterStudents() {
    let list = this.data.students
    if (this.data.searchKeyword) {
      list = list.filter(s =>
        s.name.toLowerCase().includes(this.data.searchKeyword) ||
        (s.parent_phone || '').includes(this.data.searchKeyword)
      )
    }
    if (this.data.activeTag) {
      list = list.filter(s => s.tags && s.tags.includes(this.data.activeTag))
    }
    this.setData({ filteredStudents: list })
  },

  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({
      activeTag: this.data.activeTag === tag ? '' : tag
    })
    this.filterStudents()
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/teacher/students/add' })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id || (e.detail && e.detail.student && e.detail.student._id)
    if (id) {
      wx.navigateTo({ url: `/pages/teacher/students/detail?id=${id}` })
    }
  },

  async deleteStudent(studentId) {
    if (!studentId) {
      wx.showToast({ title: '学员数据不完整', icon: 'none' })
      return
    }
    wx.showLoading({ title: '正在删除' })
    try {
      const result = await api.deleteStudent(studentId)
      if (result.success) {
        wx.hideLoading()
        wx.showToast({ title: '学员已删除', icon: 'success' })
        this.loadData()
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
    }
  },

  onStudentLongPress(e) {
    const student = e.detail.student
    if (!student || !student._id) {
      wx.showToast({ title: '学员数据不完整', icon: 'none' })
      return
    }
    wx.showActionSheet({
      itemList: ['编辑信息', student.status === 'active' ? '标记结业' : '标记在读', '删除学员'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: `/pages/teacher/students/add?id=${student._id}` })
        } else if (res.tapIndex === 1) {
          const newStatus = student.status === 'active' ? 'archived' : 'active'
          api.updateStudent(student._id, { status: newStatus }).then(() => {
            wx.showToast({ title: '已更新', icon: 'success' })
            this.loadData()
          }).catch(err => {
            wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' })
          })
        } else if (res.tapIndex === 2) {
          const deleteContent = this.data.isAdmin
            ? `确定删除学员 ${student.name} 吗？\n将同时删除该学员的课时、缴费、考勤、反馈等所有相关数据。`
            : `确定删除学员 ${student.name} 吗？\n将删除该学员的教学记录；如有关联记录，需要管理员处理。`
          wx.showModal({
            title: '确认删除',
            content: deleteContent,
            success: (r) => {
              if (r.confirm) {
                this.deleteStudent(student._id)
              }
            }
          })
        }
      }
    })
  }
})
