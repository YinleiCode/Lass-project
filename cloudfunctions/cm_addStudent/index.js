// 新增学员
const cloud = require('wx-server-sdk')
const { requireTeacher, isAuthError } = require('./auth')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { name, parent_name, parent_phone, enroll_date, tags, remark } = event

  if (!name) {
    return { success: false, message: '请输入学员姓名' }
  }

  try {
    await requireTeacher()

    const data = {
      name,
      parent_name: parent_name || '',
      parent_phone: parent_phone || '',
      enroll_date: enroll_date || '',
      tags: tags || [],
      remark: remark || '',
      total_attended: 0,
      status: 'active',
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }

    const res = await db.collection('students').add({ data })

    return { success: true, message: '添加成功', studentId: res._id }
  } catch (err) {
    if (isAuthError(err)) {
      return { success: false, message: err.message, code: err.code }
    }
    console.error('新增学员失败', err)
    return { success: false, message: err.message }
  }
}