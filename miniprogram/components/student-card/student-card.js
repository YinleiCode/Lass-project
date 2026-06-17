Component({
  properties: {
    student: { type: Object, value: {} },
    remaining: { type: Number, value: 0 },
    showOwner: { type: Boolean, value: false }
  },
  computed: {},
  data: {
    balanceClass: ''
  },
  observers: {
    'remaining': function(val) {
      if (val <= 3) {
        this.setData({ balanceClass: 'danger' })
      } else if (val <= 5) {
        this.setData({ balanceClass: 'warning' })
      } else {
        this.setData({ balanceClass: '' })
      }
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { student: this.data.student })
    },
    onLongPress() {
      this.triggerEvent('longpress', { student: this.data.student })
    }
  }
})
