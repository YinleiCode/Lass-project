// 云端身份识别：避免前端直接读 teachers/students 受权限影响
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function isAdminTeacher(teacher) {
  if (!teacher) return false
  const role = String(teacher.role || teacher.user_role || '').toLowerCase()
  return teacher.is_admin === true ||
    teacher.is_admin === 1 ||
    teacher.is_admin === 'true' ||
    teacher.is_admin === '1' ||
    teacher.isAdmin === true ||
    teacher.isAdmin === 1 ||
    teacher.isAdmin === 'true' ||
    teacher.isAdmin === '1' ||
    ['admin', 'super_admin', 'principal', 'owner'].includes(role)
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { success: false, role: '', userInfo: null, message: '未登录' }

  try {
    const teacherRes = await db.collection('teachers')
      .where({ openid: OPENID })
      .limit(1)
      .get()

    if (teacherRes.data.length > 0) {
      const teacher = teacherRes.data[0]
      const isAdmin = isAdminTeacher(teacher)
      return {
        success: true,
        role: 'teacher',
        roleLabel: isAdmin ? '校长/管理员' : '老师',
        userInfo: {
          ...teacher,
          is_admin: isAdmin
        }
      }
    }

    const studentRes = await db.collection('students')
      .where({ parent_openid: OPENID })
      .limit(1)
      .get()

    if (studentRes.data.length > 0) {
      return { success: true, role: 'parent', roleLabel: '家长/学员', userInfo: studentRes.data[0] }
    }

    return { success: true, role: '', userInfo: null }
  } catch (err) {
    console.error('身份识别失败', err)
    return { success: false, role: '', userInfo: null, message: '身份识别失败' }
  }
}
