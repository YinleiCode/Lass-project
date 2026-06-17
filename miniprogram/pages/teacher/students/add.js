const api = require('../../../utils/api')
const format = require('../../../utils/format')
const app = getApp()

Page({
  data: {
    studentId: '',
    name: '',
    parentName: '',
    parentPhone: '',
    enrollDate: '',
    tagInput: '',
    tags: [],
    remark: '',
    loading: false,
    isEdit: false
  },

  onLoad(options) {
    const today = new Date()
    const defaultDate = format.date(today)
    this.setData({ enrollDate: defaultDate })

    if (options.id) {
      this.setData({ isEdit: true, studentId: options.id })
      this.loadStudent(options.id)
    }
  },

  async loadStudent(id) {
    this.setData({ loading: true })
    try {
      const student = await api.getStudent(id)
      this.setData({
        name: student.name,
        parentName: student.parent_name || '',
        parentPhone: student.parent_phone || '',
        enrollDate: student.enroll_date || format.date(new Date()),
        tags: student.tags || [],
        remark: student.remark || '',
        loading: false
      })
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '学员加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value.trim() }) },
  onParentNameInput(e) { this.setData({ parentName: e.detail.value.trim() }) },
  onPhoneInput(e) { this.setData({ parentPhone: e.detail.value.trim() }) },
  onDateChange(e) { this.setData({ enrollDate: e.detail.value }) },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },

  onTagInput(e) {
    this.setData({ tagInput: e.detail.value })
  },

  addTag() {
    const tag = this.data.tagInput.trim()
    if (!tag) return
    if (this.data.tags.includes(tag)) {
      wx.showToast({ title: '标签已存在', icon: 'none' })
      return
    }
    this.setData({
      tags: [...this.data.tags, tag],
      tagInput: ''
    })
  },

  removeTag(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({
      tags: this.data.tags.filter(t => t !== tag)
    })
  },

  async onSave() {
    if (this.data.loading) return
    const { name, parentPhone, parentName, enrollDate, tags, remark } = this.data

    if (!name) {
      wx.showToast({ title: '请输入学员姓名', icon: 'none' })
      return
    }
    if (!parentPhone || !format.isPhone(parentPhone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (this.data.isEdit && !this.data.studentId) {
      wx.showToast({ title: '学员数据不完整', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    const data = {
      name,
      parent_phone: parentPhone,
      parent_name: parentName,
      enroll_date: enrollDate,
      tags,
      remark
    }

    try {
      if (this.data.isEdit) {
        const result = await api.updateStudent(this.data.studentId, data)
        if (!result || result.success === false) {
          throw new Error((result && result.message) || '更新失败')
        }
        wx.showToast({ title: '已更新', icon: 'success' })
      } else {
        const result = await api.addStudent(data)
        if (!result || result.success === false) {
          throw new Error((result && result.message) || '添加失败')
        }
        wx.showToast({ title: '添加成功', icon: 'success' })
      }
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      console.error('保存学员失败', err)
      const msg = (err && (err.message || err.errMsg)) || '保存失败，请重试'
      wx.showToast({ title: msg, icon: 'none' })
      this.setData({ loading: false })
    }
  }
})
