const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function assertMatch(file, pattern, message) {
  const text = read(file)
  if (!pattern.test(text)) {
    throw new Error(`${file}: ${message}`)
  }
}

function assertNotMatch(file, pattern, message) {
  const text = read(file)
  if (pattern.test(text)) {
    throw new Error(`${file}: ${message}`)
  }
}

const checks = [
  () => assertMatch(
    'cloudfunctions/cm_getStudentDetail/index.js',
    /isAdmin\s*\?\s*db\.collection\('orders'\)/,
    'orders query must be admin-gated'
  ),
  () => assertMatch(
    'cloudfunctions/cm_getStudentDetail/index.js',
    /:\s*Promise\.resolve\(\{\s*data:\s*\[\]\s*\}\)/,
    'ordinary teachers must receive no orders'
  ),
  () => assertMatch(
    'cloudfunctions/cm_getPackages/index.js',
    /delete item\.unit_price/,
    'ordinary teachers must not receive course package unit prices'
  ),
  () => assertMatch(
    'cloudfunctions/cm_batchBalance/index.js',
    /includePackages\s*&&\s*isAdmin[\s\S]*?\?\s*await getByStudentFields\('orders'/,
    'paid package aggregation must only query orders for admins'
  ),
  () => assertMatch(
    'cloudfunctions/cm_getParentData/index.js',
    /action === 'orders'[\s\S]*?当前账号不能查看此页面/,
    'parent order action must be rejected'
  ),
  () => assertMatch(
    'cloudfunctions/cm_stats/index.js',
    /adminMoneyFields[\s\S]*?\?\s*\{[\s\S]*?monthIncome[\s\S]*?monthIncome_str[\s\S]*?\}[\s\S]*?:\s*\{\}/,
    'income stats must only be returned for admins'
  ),
  () => assertNotMatch(
    'cloudfunctions/cm_getParentData/index.js',
    /db\.collection\('orders'\)/,
    'parent data function must not query orders'
  ),
  () => assertMatch(
    'cloudfunctions/cm_getSchedules/index.js',
    /!isAdmin && !await hasScheduleAccess/,
    'single schedule read must check fallback schedule access'
  ),
  () => assertMatch(
    'cloudfunctions/cm_checkin/index.js',
    /!isAdmin && !await hasScheduleAccess/,
    'checkin must check fallback schedule access'
  ),
  () => assertMatch(
    'cloudfunctions/cm_undoCheckin/index.js',
    /!isAdmin && !await hasScheduleAccess/,
    'undo checkin must check fallback schedule access'
  ),
  () => assertMatch(
    'cloudfunctions/cm_saveFeedback/index.js',
    /!isAdmin && !await hasScheduleAccess/,
    'feedback save must check fallback schedule access'
  ),
  () => assertMatch(
    'cloudfunctions/cm_deleteStudent/index.js',
    /hasStudentRows\('orders', studentId\)/,
    'ordinary teacher deletion must be blocked when payment orders exist'
  ),
  () => assertMatch(
    'miniprogram/pages/teacher/calendar/calendar.js',
    /请联系管理员补课时/,
    'ordinary teacher empty package hint must not direct them to register payment'
  ),
  () => assertMatch(
    'miniprogram/pages/parent/home/home.wxml',
    /剩余课时/,
    'parent home should show lesson balance'
  ),
  () => assertNotMatch(
    'miniprogram/pages/parent/home/home.wxml',
    /剩余课费|资金余额|累计缴费|已购课时/,
    'parent home must not show financial labels'
  ),
  () => assertNotMatch(
    'miniprogram/pages/parent/home/home.js',
    /课费|缴费|金额/,
    'parent home JS must not mention financial labels'
  )
]

for (const check of checks) check()

console.log(`permission regression checks passed (${checks.length})`)
