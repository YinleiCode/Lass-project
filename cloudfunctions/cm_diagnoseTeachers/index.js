// 一次性诊断脚本：列出 teachers 表所有记录
// 部署后在云开发控制台调用：wx.cloud.callFunction({ name: 'cm_diagnoseTeachers' })
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const res = await db.collection('teachers').get()
  const records = res.data.map(t => ({
    openid: (t.openid || '').substring(0, 8) + '****',
    name: t.name || '(未填)',
    created_at: t.created_at ? new Date(t.created_at).toISOString() : '(未知)',
    is_admin: !!t.is_admin,
    phone: t.phone || '(未填)'
  }))

  return {
    success: true,
    total: records.length,
    records
  }
}
