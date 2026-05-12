// 日期和金额格式化工具
// 所有日期函数对 null/空字符串/非法日期 一律返回 '',不允许返回 'undefined' 或 'NaN'

const format = {
  // 内部:把任意输入转成合法 Date 对象,失败返回 null
  _toDate(d) {
    if (d === null || d === undefined || d === '') return null
    const date = new Date(d)
    return isNaN(date.getTime()) ? null : date
  },

  // 日期格式化 '2026-05-07'
  date(d) {
    const date = this._toDate(d)
    if (!date) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  // 时间格式化 '18:00'
  time(d) {
    const date = this._toDate(d)
    if (!date) return ''
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  },

  // 日期+时间 '2026-05-07 18:00'
  datetime(d) {
    const dateStr = this.date(d)
    if (!dateStr) return ''
    return dateStr + ' ' + this.time(d)
  },

  // 友好日期 '5月7日'
  friendlyDate(d) {
    const date = this._toDate(d)
    if (!date) return ''
    return `${date.getMonth() + 1}月${date.getDate()}日`
  },

  // 星期 '周一' ... '周日'
  weekday(d) {
    const date = this._toDate(d)
    if (!date) return ''
    const days = ['日', '一', '二', '三', '四', '五', '六']
    return '周' + days[date.getDay()]
  },

  // 金额格式化 ¥6,000
  money(n) {
    if (n === undefined || n === null) return '¥0'
    return '¥' + Number(n).toLocaleString()
  },

  // 相对时间 '3分钟前'
  timeAgo(d) {
    const date = this._toDate(d)
    if (!date) return ''
    const now = new Date()
    const diff = (now - date) / 1000

    if (diff < 60) return '刚刚'
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
    if (diff < 2592000) return Math.floor(diff / 86400) + '天前'
    return this.date(d)
  },

  // 获取本周起止日期
  getWeekRange(date) {
    const d = new Date(date)
    const day = d.getDay() || 7 // 周日=7
    const monday = new Date(d)
    monday.setDate(d.getDate() - day + 1)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return {
      start: this.date(monday),
      end: this.date(sunday),
      days: Array.from({ length: 7 }, (_, i) => {
        const dd = new Date(monday)
        dd.setDate(monday.getDate() + i)
        return {
          date: this.date(dd),
          day: dd.getDate(),
          weekday: ['一', '二', '三', '四', '五', '六', '日'][i],
          isToday: this.date(dd) === this.date(new Date())
        }
      })
    }
  },

  // 手机号校验
  isPhone(str) {
    return /^1[3-9]\d{9}$/.test(str)
  },

  // 手机号脱敏 138****8000
  maskPhone(phone) {
    if (!phone || phone.length !== 11) return phone
    return phone.substring(0, 3) + '****' + phone.substring(7)
  }
}

module.exports = format
