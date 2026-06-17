// 一次性诊断脚本：列出 teachers 表所有记录
// 部署后在云开发控制台调用：wx.cloud.callFunction({ name: 'cm_diagnoseTeachers' })
const cloud = require('wx-server-sdk')
const { requireAdmin, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    await requireAdmin()

    const res = await db.collection('teachers').get()
    const records = res.data.map(t => ({
      openid: (t.openid || '').substring(0, 8) + '****',
      name: t.name || '(未填)',
      created_at: t.created_at ? new Date(t.created_at).toISOString() : '(未知)',
      is_admin: !!t.is_admin,
      phone: t.phone ? t.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '(未填)'
    }))

    return {
      success: true,
      total: records.length,
      records
    }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('诊断老师数据失败', err)
    return { success: false, message: '诊断失败' }
  }
}
