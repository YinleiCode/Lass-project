const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')

Page({
  data: {
    loading: true,
    schedule: null,
    student: null,
    studentId: '',
    scheduleId: '',
    ratings: {},
    comment: '',
    audioFileId: '',
    audioFiles: [],
    hasAudio: false,
    audioUploading: false,
    replacingAudio: false,
    dimensions: constants.FEEDBACK_DIMENSIONS,
    submitting: false,
    currentStudentIndex: 0,
    students: [],
    dirty: false,
    missingContext: false,
    loadError: false,
    loadErrorMessage: '',
    ratingSummary: '0/5',
    canSave: false,
    saveHint: '至少完成一项评分后可保存',
    activeDimensionKey: ''
  },

  buildFeedbackState(ratings = {}, audioUploading = this.data.audioUploading, studentId = this.data.studentId, scheduleId = this.data.scheduleId) {
    const ratedCount = constants.FEEDBACK_DIMENSIONS
      .filter(dim => Number(ratings[dim.key] || 0) > 0)
      .length
    const canSave = !!studentId && !!scheduleId && !audioUploading && ratedCount > 0
    let saveHint = ratedCount > 0 ? `已完成 ${ratedCount} 项评分` : '至少完成一项评分后可保存'
    if (audioUploading) saveHint = '录音上传中，请稍后保存'
    if (!studentId) saveHint = '请选择学员'
    return {
      ratingSummary: `${ratedCount}/${constants.FEEDBACK_DIMENSIONS.length}`,
      ratedCount,
      canSave,
      saveHint
    }
  },

  onLoad(options) {
    const { scheduleId, studentId } = options
    if (!scheduleId) {
      wx.showToast({ title: '缺少课程信息', icon: 'none' })
      this.setData({ loading: false, missingContext: true, loadError: false, loadErrorMessage: '' })
      return
    }
    this.setData({ scheduleId, missingContext: false, loadError: false, loadErrorMessage: '' })
    if (studentId) {
      this.setData({ studentId })
    }
    this.loadData(scheduleId, studentId)
  },

  async loadData(scheduleId, studentId) {
    this.setData({ loading: true, loadError: false, loadErrorMessage: '' })
    try {
      const schedule = await api.getSchedule(scheduleId)
      if (!schedule) throw new Error('排课不存在或无权访问')
      const scheduleStudents = Array.isArray(schedule.student_ids) ? schedule.student_ids : []
      if (!scheduleStudents.length) throw new Error('这节课没有关联学员')

      const enrolledResults = await Promise.all(scheduleStudents.map(id => api.getStudent(id).catch(() => null)))
      const enrolled = enrolledResults.filter(Boolean)
      if (!enrolled.length) throw new Error('未找到这节课的学员')

      // 默认选中第一个学员
      const targetStudentId = studentId || (enrolled.length > 0 ? enrolled[0]._id : '')
      const student = enrolled.find(s => s._id === targetStudentId)

      // 加载已有反馈
      let existingFeedback = null
      if (targetStudentId) {
        existingFeedback = await api.getFeedback(scheduleId, targetStudentId)
      }

      const ratings = {}
      for (const dim of constants.FEEDBACK_DIMENSIONS) {
        ratings[dim.key] = (existingFeedback && existingFeedback.ratings && existingFeedback.ratings[dim.key]) || 0
      }

      const audioFiles = existingFeedback && Array.isArray(existingFeedback.audio_files)
        ? existingFeedback.audio_files.filter(Boolean)
        : []

      this.setData({
        schedule,
        students: enrolled,
        student: student || enrolled[0] || null,
        studentId: targetStudentId,
        ratings,
        comment: existingFeedback ? (existingFeedback.comment || '') : '',
        audioFileId: audioFiles[0] || '',
        audioFiles,
        hasAudio: audioFiles.length > 0,
        audioUploading: false,
        replacingAudio: false,
        dirty: false,
        loadError: false,
        loadErrorMessage: '',
        loading: false,
        ...this.buildFeedbackState(ratings, false, targetStudentId, scheduleId)
      })
    } catch (err) {
      const message = (err && err.message) || '加载失败，请重试'
      wx.showToast({ title: message, icon: 'none' })
      this.setData({
        loading: false,
        loadError: true,
        loadErrorMessage: message,
        schedule: null,
        student: null,
        studentId: studentId || '',
        students: [],
        ratings: {},
        comment: '',
        audioFileId: '',
        audioFiles: [],
        hasAudio: false,
        audioUploading: false,
        replacingAudio: false,
        dirty: false,
        ...this.buildFeedbackState({}, false, studentId || '', scheduleId)
      })
    }
  },

  onRatingChange(e) {
    const { key } = e.currentTarget.dataset
    const ratings = {
      ...this.data.ratings,
      [key]: e.detail.value
    }
    this.setData({
      ratings,
      activeDimensionKey: key,
      dirty: true,
      ...this.buildFeedbackState(ratings)
    })
  },

  onCommentInput(e) {
    this.setData({ comment: e.detail.value, dirty: true })
  },

  useTemplate(e) {
    const type = e.currentTarget.dataset.type
    const targetDimensionKey = e.currentTarget.dataset.dimension || this.data.activeDimensionKey
    const template = constants.FEEDBACK_TEMPLATES[type]
    if (!this.data.student) {
      wx.showToast({ title: '请先选择学员', icon: 'none' })
      return
    }
    if (template) {
      const name = this.data.student.name || '同学'
      const dimensions = this.data.dimensions || constants.FEEDBACK_DIMENSIONS
      const ratings = this.data.ratings || {}
      const ratedDimension = dimensions.find(dim => Number(ratings[dim.key] || 0) > 0)
      const selectedDimension = dimensions.find(dim => dim.key === targetDimensionKey) || ratedDimension || dimensions[0]
      const dimension = selectedDimension ? selectedDimension.label : '课堂表现'
      this.setData({
        comment: template.replace(/\{name\}/g, name).replace(/\{dimension\}/g, dimension),
        dirty: true
      })
    }
  },

  goCalendar() {
    wx.switchTab({ url: '/pages/teacher/calendar/calendar' })
  },

  onAudioChange(e) {
    const fileID = e.detail.fileID || ''
    this.setData({
      audioFileId: fileID,
      audioFiles: fileID ? [fileID] : [],
      hasAudio: !!fileID,
      audioUploading: false,
      dirty: true,
      ...this.buildFeedbackState(this.data.ratings, false)
    })
  },

  onAudioUploading(e) {
    const uploading = !!e.detail.uploading
    this.setData({
      audioUploading: uploading,
      ...this.buildFeedbackState(this.data.ratings, uploading)
    })
  },

  onReplaceAudio() {
    if (this.data.audioUploading || this.data.submitting) return
    this.setData({ replacingAudio: true })
  },

  onCancelReplaceAudio() {
    if (this.data.audioUploading || this.data.submitting) return
    this.setData({ replacingAudio: false })
  },

  switchStudent(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const student = this.data.students[index]
    if (student && student._id !== this.data.studentId) {
      if (this.data.dirty) {
        wx.showModal({
          title: '先保存这份回声吗',
          content: '当前学员的评分、评语或录音还没有保存。',
          confirmText: '保存',
          cancelText: '直接切换',
          success: async (res) => {
            if (res.confirm) {
              const ok = await this.saveCurrentFeedback(false)
              if (ok) this.loadData(this.data.scheduleId, student._id)
            } else {
              this.loadData(this.data.scheduleId, student._id)
            }
          }
        })
      } else {
        this.loadData(this.data.scheduleId, student._id)
      }
    }
  },

  async saveCurrentFeedback(showToast = true) {
    const { scheduleId, studentId, ratings, comment, audioFileId, audioFiles, audioUploading } = this.data

    if (!scheduleId) {
      wx.showToast({ title: '缺少课程信息', icon: 'none' })
      return false
    }
    if (!studentId) {
      wx.showToast({ title: '请选择学员', icon: 'none' })
      return false
    }
    if (audioUploading) {
      wx.showToast({ title: '录音上传中，请稍后保存', icon: 'none' })
      return false
    }
    const cleanRatings = {}
    for (const dim of constants.FEEDBACK_DIMENSIONS) {
      const value = Number(ratings[dim.key] || 0)
      if (Number.isInteger(value) && value > 0) {
        cleanRatings[dim.key] = value
      }
    }
    if (Object.keys(cleanRatings).length === 0) {
      wx.showToast({ title: '请至少完成一项评分', icon: 'none' })
      return false
    }

    this.setData({ submitting: true })

    try {
      const data = {
        schedule_id: scheduleId,
        student_id: studentId,
        ratings: cleanRatings,
        comment,
        audio_files: audioFileId ? [audioFileId] : (audioFiles || [])
      }

      const result = await api.saveFeedback(data)
      if (!result || result.success === false) {
        throw new Error((result && result.message) || '反馈保存失败')
      }
      if (showToast) wx.showToast({ title: '反馈已保存', icon: 'success' })
      this.setData({ dirty: false })
      return true
    } catch (err) {
      console.error('保存反馈失败', err)
      wx.showToast({ title: (err && err.message) || '保存失败，请重试', icon: 'none' })
      return false
    } finally {
      this.setData({ submitting: false })
    }
  },

  async onSave() {
    const { scheduleId, studentId } = this.data
    const ok = await this.saveCurrentFeedback(true)
    if (!ok) return

    // 如果还有下一个学员未反馈，自动切换
    const currentIdx = this.data.students.findIndex(s => s._id === studentId)
    if (currentIdx >= 0 && currentIdx < this.data.students.length - 1) {
      const nextStudent = this.data.students[currentIdx + 1]
      await this.loadData(scheduleId, nextStudent._id)
    } else {
      setTimeout(() => wx.navigateBack(), 1500)
    }
  }
})
