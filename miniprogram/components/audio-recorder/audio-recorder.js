Component({
  properties: {
    value: { type: String, value: '' },
    readonly: { type: Boolean, value: false }
  },

  data: {
    state: 'idle',        // idle | recording | playing | done
    recordingTime: 0,
    tempFilePath: '',
    duration: 0,
    playing: false,
    uploading: false,
    uploadDone: false,
    audioContext: null,
    recorderManager: null,
    timer: null,
    recordingStartedAt: 0,
    recordingTip: ''
  },

  observers: {
    'value': function(val) {
      if (val && this.data.state === 'idle') {
        this.setData({ state: 'done' })
      }
    }
  },

  lifetimes: {
    attached() {
      this.initRecorder()
    },

    detached() {
      this.stopTimer()
      if (this.data.audioContext) {
        this.data.audioContext.destroy()
      }
      if (this.data.recorderManager) {
        const recorderManager = this.data.recorderManager
        if (typeof recorderManager.offStart === 'function') recorderManager.offStart()
        if (typeof recorderManager.offStop === 'function') recorderManager.offStop()
        if (typeof recorderManager.offError === 'function') recorderManager.offError()
      }
    }
  },

  methods: {
    initRecorder() {
      if (this.data.recorderManager) return
      const recorderManager = wx.getRecorderManager()

      recorderManager.onStart(() => {
        this.setData({
          state: 'recording',
          recordingTime: 0,
          recordingStartedAt: Date.now(),
          recordingTip: '正在录音'
        })
        this.startTimer()
      })

      recorderManager.onError((err) => {
        console.error('录音失败', err)
        this.stopTimer()
        wx.showToast({ title: '录音失败', icon: 'none' })
        this.setData({ state: 'idle', recordingStartedAt: 0, recordingTip: '录音失败，请重试' })
      })

      recorderManager.onStop((res) => {
        this.stopTimer()
        const durationMs = res.duration || this.data.recordingTime * 1000
        if (!res.tempFilePath || durationMs < 800) {
          wx.showToast({ title: '录音太短，请重录', icon: 'none' })
          this.setData({
            state: 'idle',
            tempFilePath: '',
            duration: 0,
            recordingTime: 0,
            recordingStartedAt: 0,
            recordingTip: '录音太短，请重新录制'
          })
          return
        }
        this.setData({
          tempFilePath: res.tempFilePath,
          duration: Math.ceil(durationMs / 1000),
          state: 'done',
          recordingStartedAt: 0,
          recordingTip: '本地录音已生成，正在上传'
        })
        this.uploadFile(res.tempFilePath)
      })

      this.setData({ recorderManager })
    },

    // 开始录音
    startRecord() {
      this.initRecorder()
      if (this.data.state === 'recording') return
      wx.authorize({
        scope: 'scope.record',
        success: () => this.doStartRecord(),
        fail: () => {
          wx.showModal({
            title: '需要麦克风权限',
            content: '请允许麦克风权限后再录音',
            confirmText: '去设置',
            success: res => {
              if (res.confirm) wx.openSetting()
            }
          })
        }
      })
    },

    doStartRecord() {
      const recorderManager = this.data.recorderManager
      const options = { duration: 180000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'aac' }
      this.setData({ recordingTip: '准备录音' })
      recorderManager.start(options)
    },

    // 停止录音
    stopRecord() {
      if (this.data.recorderManager) {
        this.data.recorderManager.stop()
      }
    },

    // 上传到云存储
    uploadFile(filePath) {
      const ext = filePath.split('.').pop() || 'aac'
      const cloudPath = `recordings/${Date.now()}.${ext}`

      wx.showLoading({ title: '正在上传' })
      this.setData({ uploading: true, uploadDone: false })
      this.triggerEvent('uploading', { uploading: true })

      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: res => {
          this.setData({ state: 'done', uploading: false, uploadDone: true, recordingTip: '录音已保存，可试听' })
          this.triggerEvent('uploading', { uploading: false })
          this.triggerEvent('change', { fileID: res.fileID })
          wx.hideLoading()
        },
        fail: () => {
          wx.hideLoading()
          wx.showToast({ title: '上传失败', icon: 'none' })
          this.setData({ state: 'idle', tempFilePath: '', uploading: false, uploadDone: false, recordingTip: '上传失败，请重录' })
          this.triggerEvent('uploading', { uploading: false })
        }
      })
    },

    // 播放录音
    togglePlay() {
      if (this.data.playing) {
        this.data.audioContext.stop()
        this.setData({ playing: false })
        return
      }

      if (this.data.value) {
        wx.showLoading({ title: '正在载入' })
        wx.cloud.getTempFileURL({
          fileList: [this.data.value],
          success: res => {
            wx.hideLoading()
            if (res.fileList.length > 0) {
              this.playAudio(res.fileList[0].tempFileURL)
            }
          },
          fail: () => {
            wx.hideLoading()
            wx.showToast({ title: '加载失败', icon: 'none' })
          }
        })
      } else if (this.data.tempFilePath) {
        this.playAudio(this.data.tempFilePath)
      }
    },

    playAudio(url) {
      if (this.data.audioContext) {
        this.data.audioContext.destroy()
      }
      const audioContext = wx.createInnerAudioContext()
      audioContext.obeyMuteSwitch = false
      audioContext.src = url
      audioContext.play()
      audioContext.onEnded(() => {
        this.setData({ playing: false })
      })
      audioContext.onError(() => {
        wx.showToast({ title: '播放失败', icon: 'none' })
        this.setData({ playing: false })
      })
      this.setData({ audioContext, playing: true })
    },

    // 删除录音
    deleteRecord() {
      wx.showModal({
        title: '确认删除',
        content: '删除后无法恢复',
        success: (res) => {
          if (res.confirm) {
            this.setData({ state: 'idle', tempFilePath: '', duration: 0, value: '', uploadDone: false, uploading: false })
            this.triggerEvent('change', { fileID: '' })
          }
        }
      })
    },

    // 计时器
    startTimer() {
      this.stopTimer()
      const startedAt = this.data.recordingStartedAt || Date.now()
      const timer = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000)
        this.setData({ recordingTime: seconds })
      }, 1000)
      this.setData({ timer })
    },

    stopTimer() {
      if (this.data.timer) {
        clearInterval(this.data.timer)
        this.setData({ timer: null })
      }
    }
  }
})
