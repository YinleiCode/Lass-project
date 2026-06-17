function isAdminUser(user) {
  if (!user) return false
  const role = String(user.role || user.user_role || '').toLowerCase()
  return user.is_admin === true ||
    user.is_admin === 1 ||
    user.is_admin === 'true' ||
    user.is_admin === '1' ||
    user.isAdmin === true ||
    user.isAdmin === 1 ||
    user.isAdmin === 'true' ||
    user.isAdmin === '1' ||
    ['admin', 'super_admin', 'principal', 'owner'].includes(role)
}

module.exports = {
  isAdminUser
}
