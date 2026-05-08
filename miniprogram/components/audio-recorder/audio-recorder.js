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
    audioContext: null,
    recorderManager: null,
    timer: null
  },

  observers: {
    'value': function(val) {
      if (val && this.data.state === 'idle') {
        this.setData({ state: 'done' })
      }
    }
  },

  lifetimes: {
    detached() {
      this.stopTimer()
      if (this.data.audioContext) {
        this.data.audioContext.destroy()
      }
    }
  },

  methods: {
    // 开始录音
    startRecord() {
      const recorderManager = wx.getRecorderManager()
      const options = { duration: 180000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'aac' }

      recorderManager.onStart(() => {
        this.setData({ state: 'recording', recordingTime: 0 })
        this.startTimer()
      })

      recorderManager.onError(() => {
        wx.showToast({ title: '录音失败', icon: 'none' })
        this.setData({ state: 'idle' })
      })

      recorderManager.onStop((res) => {
        this.stopTimer()
        this.setData({
          tempFilePath: res.tempFilePath,
          duration: Math.ceil(res.duration / 1000),
          state: 'done'
        })
        this.uploadFile(res.tempFilePath)
      })

      recorderManager.start(options)
      this.setData({ recorderManager })
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

      wx.showLoading({ title: '上传中...' })

      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: res => {
          this.setData({ state: 'done' })
          this.triggerEvent('change', { fileID: res.fileID })
          wx.hideLoading()
        },
        fail: () => {
          wx.hideLoading()
          wx.showToast({ title: '上传失败', icon: 'none' })
          this.setData({ state: 'idle', tempFilePath: '' })
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
        wx.showLoading({ title: '加载中...' })
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
      const audioContext = wx.createInnerAudioContext()
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
            this.setData({ state: 'idle', tempFilePath: '', duration: 0, value: '' })
            this.triggerEvent('change', { fileID: '' })
          }
        }
      })
    },

    // 计时器
    startTimer() {
      this.data.timer = setInterval(() => {
        this.setData({ recordingTime: this.data.recordingTime + 1 })
      }, 1000)
    },

    stopTimer() {
      if (this.data.timer) {
        clearInterval(this.data.timer)
        this.data.timer = null
      }
    }
  }
})
