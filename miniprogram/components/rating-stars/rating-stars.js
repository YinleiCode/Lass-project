Component({
  properties: {
    label: { type: String, value: '' },
    value: { type: Number, value: 0 },
    readonly: { type: Boolean, value: false }
  },
  methods: {
    onTap(e) {
      if (this.data.readonly) return
      const score = e.currentTarget.dataset.score
      this.setData({ value: score })
      this.triggerEvent('change', { value: score })
    }
  }
})
