const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')
const role = require('../../../utils/role')

Page({
  data: {
    loading: true,
    feedback: null,
    commentText: '',
    audioFiles: [],
    hasAudio: false,
    dimensions: constants.FEEDBACK_DIMENSIONS,
    scheduleInfo: null,
    scheduleDateText: '',
    packageNameText: '',
    scheduleMetaText: '',
    scheduleTeacherText: '',
    ratings: {},
    format: format
  },

  async onLoad(options) {
    const { scheduleId } = options
    const ok = await role.ensureParentAccess()
    if (!ok) {
      this.setData({ loading: false })
      return
    }
    if (scheduleId) {
      this.loadData(scheduleId)
    } else {
      wx.showToast({ title: '缺少回声信息', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async loadData(scheduleId) {
    this.setData({ loading: true })
    try {
      const data = await api.getParentFeedbackDetail(scheduleId)
      const feedback = data.feedback || null
      const scheduleInfo = data.scheduleInfo || null
      const ratings = feedback && feedback.ratings ? feedback.ratings : {}
      const audioFiles = feedback && Array.isArray(feedback.audio_files)
        ? feedback.audio_files.filter(Boolean)
        : []
      this.setData({
        feedback,
        scheduleInfo,
        scheduleDateText: scheduleInfo ? (format.datetime(scheduleInfo.start_time) || scheduleInfo.start_time || '') : '',
        packageNameText: scheduleInfo && scheduleInfo.package_name ? scheduleInfo.package_name : '课程',
        scheduleMetaText: scheduleInfo ? [scheduleInfo.class_display || scheduleInfo.class_type_label, scheduleInfo.duration_text, scheduleInfo.delivery_mode_label].filter(Boolean).join(' · ') : '',
        scheduleTeacherText: scheduleInfo && scheduleInfo.teacher_name ? `授课老师：${scheduleInfo.teacher_name}` : '',
        commentText: feedback && feedback.comment ? String(feedback.comment) : '',
        ratings,
        audioFiles,
        hasAudio: audioFiles.length > 0,
        loading: false
      })
    } catch (err) {
      console.error('反馈详情加载失败', err)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
  }
})
