const api = require('../../../utils/api')
const format = require('../../../utils/format')
const constants = require('../../../utils/constants')

Page({
  data: {
    loading: true,
    feedback: null,
    dimensions: constants.FEEDBACK_DIMENSIONS,
    scheduleInfo: null,
    format: format
  },

  onLoad(options) {
    const { scheduleId, studentId } = options
    if (scheduleId && studentId) {
      this.loadData(scheduleId, studentId)
    }
  },

  async loadData(scheduleId, studentId) {
    this.setData({ loading: true })
    try {
      const feedback = await api.getFeedback(scheduleId, studentId)

      // 加载排课信息
      let scheduleInfo = null
      try {
        const db = wx.cloud.database()
        const res = await db.collection('schedules').doc(scheduleId).get()
        scheduleInfo = res.data
      } catch (e) {

        console.error("操作失败", e)

        wx.showToast({ title: "操作失败", icon: "none" })

      }


      this.setData({ feedback, scheduleInfo, loading: false })
    } catch (err) {
      this.setData({ loading: false })
    }
  }
})
