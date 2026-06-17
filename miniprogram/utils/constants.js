// 常量定义

module.exports = {
  // 考勤状态
  ATTENDANCE_STATUS: {
    PRESENT: 'present',   // 到课
    ABSENT: 'absent',     // 缺勤
    LEAVE: 'leave',       // 请假
    MAKEUP: 'makeup'      // 补课
  },

  // 排课状态
  SCHEDULE_STATUS: {
    PENDING: 'pending',     // 待上
    DONE: 'done',           // 已完成
    CANCELLED: 'cancelled'  // 已取消
  },

  // 学员状态
  STUDENT_STATUS: {
    ACTIVE: 'active',       // 在读
    ARCHIVED: 'archived'    // 结业
  },

  // 课时预警线
  BALANCE_WARNING: 3,
  BALANCE_CAUTION: 5,

  // 反馈维度
  FEEDBACK_DIMENSIONS: [
    { key: 'breath', label: '气息' },
    { key: 'pronunciation', label: '咬字' },
    { key: 'rhythm', label: '节奏' },
    { key: 'emotion', label: '情感表达' },
    { key: 'confidence', label: '台风/自信' }
  ],

  // 反馈模板
  FEEDBACK_TEMPLATES: {
    encourage: '今天{name}同学的{dimension}有明显进步，请家长继续督促每天5分钟练声。',
    problem: '本节课发现{name}在{dimension}上偏弱，建议回家多听新闻联播，体会播音员的情感投放方式。',
    homework: '本周作业：1.练习绕口令，每日3遍；2.录制一段30秒新闻播报，下次课带过来。'
  },

  // 请假原因
  LEAVE_REASONS: [
    '身体不适',
    '学校有事',
    '家庭原因',
    '其他'
  ],

  // 支付方式
  PAY_METHODS: ['微信', '现金', '转账', '其他'],

  // 排课班型
  SCHEDULE_CLASS_TYPES: {
    one_to_one: '一对一',
    one_to_three: '一对三/小班课'
  },

  SCHEDULE_CLASS_TYPE_OPTIONS: [
    { value: 'one_to_one', label: '一对一' },
    { value: 'one_to_three', label: '一对三/小班课' }
  ],

  // 上课方式
  DELIVERY_MODES: {
    offline: '线下课',
    online: '线上课'
  },

  DELIVERY_MODE_OPTIONS: [
    { value: 'offline', label: '线下课' },
    { value: 'online', label: '线上课' }
  ],

  // 课程类型
  COURSE_TYPES: {
    '1v1': '一对一',
    'small_class': '小班课',
    'big_class': '大班课',
    'trial': '体验课'
  }
}
