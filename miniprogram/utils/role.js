const app = getApp()

function routeTo(url) {
  wx.reLaunch({ url })
}

async function ensureParentAccess(options = {}) {
  if (options.teacherMode) return true

  try {
    const hasUser = app.globalData.userInfo && app.globalData.userInfo._id
    if (app.globalData._switchedFromTeacher && hasUser) {
      app.globalData.role = 'parent'
    } else if (!hasUser || !app.globalData.role) {
      await app.checkRole()
    }

    const role = app.globalData.role
    const userInfo = app.globalData.userInfo
    if (role === 'parent' && userInfo && userInfo._id) return true

    if (role === 'teacher') {
      routeTo('/pages/teacher/home/home')
      return false
    }

    routeTo('/pages/common/identity/identity')
    return false
  } catch (err) {
    console.error('家长身份检查失败', err)
    wx.showToast({ title: (err && err.message) || '身份识别失败，请重试', icon: 'none' })
    return false
  }
}

module.exports = {
  ensureParentAccess
}
