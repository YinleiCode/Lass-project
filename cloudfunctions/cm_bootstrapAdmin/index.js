// 临时初始化当前微信为管理员
// 仅当 teachers 集合无管理员时生效
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const BOOTSTRAP_ADMIN_ID = 'bootstrap_admin'

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

async function findExistingAdminId() {
  const checks = [
    { is_admin: true },
    { isAdmin: true },
    { role: 'admin' },
    { role: 'principal' },
    { role: 'owner' },
    { role: 'super_admin' },
    { user_role: 'admin' },
    { user_role: 'principal' },
    { user_role: 'owner' },
    { user_role: 'super_admin' }
  ]
  for (const query of checks) {
    const res = await db.collection('teachers').where(query).limit(1).get()
    if (res.data && res.data[0] && isAdminTeacher(res.data[0])) return res.data[0]._id
  }
  return ''
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { success: false, message: '未获取到 openid', code: 401 }

  const expectedSecret = process.env.INIT_SECRET
  if (!expectedSecret || event.secret !== expectedSecret) {
    return { success: false, message: '管理员初始化通道未开启', code: 403 }
  }

  const name = (event.name || '管理员').trim() || '管理员'

  try {
    const existingAdminId = await findExistingAdminId()

    await db.runTransaction(async transaction => {
      if (existingAdminId) {
        const adminDoc = await transaction.collection('teachers').doc(existingAdminId).get()
          .catch(() => ({ data: null }))
        if (adminDoc.data && isAdminTeacher(adminDoc.data)) {
          throw new Error('已存在管理员，不能重复初始化')
        }
      }
      const bootstrapDoc = await transaction.collection('teachers').doc(BOOTSTRAP_ADMIN_ID).get()
        .catch(() => ({ data: null }))
      if (bootstrapDoc.data && isAdminTeacher(bootstrapDoc.data)) {
        throw new Error('已存在管理员，不能重复初始化')
      }

      await transaction.collection('teachers').doc(BOOTSTRAP_ADMIN_ID).set({
        data: {
          openid: OPENID,
          name,
          is_admin: true,
          created_at: db.serverDate()
        }
      })
    })

    return { success: true, message: '管理员初始化成功', openid: OPENID }
  } catch (err) {
    console.error('初始化管理员失败', err)
    return { success: false, message: '初始化管理员失败' }
  }
}
