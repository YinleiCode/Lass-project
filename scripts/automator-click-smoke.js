const path = require('path')
const fs = require('fs')

const automator = require('/private/tmp/miniprogram-automator.Q5iUfa/node_modules/miniprogram-automator')

const projectPath = path.resolve(__dirname, '..')
const outDir = path.join(projectPath, 'preview', 'automator-click-smoke-latest')
fs.mkdirSync(outDir, { recursive: true })

const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`${mark} ${name}${detail ? ` - ${detail}` : ''}`)
}

async function withStep(name, fn) {
  try {
    const detail = await fn()
    record(name, true, detail || '')
  } catch (err) {
    record(name, false, (err && (err.stack || err.message)) || String(err))
  }
}

async function wait(ms = 300) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function setupWxMocks(miniProgram) {
  await miniProgram.evaluate(() => {
    const state = {
      toasts: [],
      modals: [],
      actionSheets: [],
      loadings: [],
      pullDownStopped: 0
    }
    globalThis.__TEST_STATE__ = state

    const wxRef = globalThis.wx
    wxRef.showToast = function (options = {}) {
      state.toasts.push({ title: options.title || '', icon: options.icon || '' })
      if (typeof options.success === 'function') options.success({})
      if (typeof options.complete === 'function') options.complete({})
    }
    wxRef.showModal = function (options = {}) {
      state.modals.push({ title: options.title || '', content: options.content || '' })
      if (typeof options.success === 'function') options.success({ confirm: true, cancel: false })
      if (typeof options.complete === 'function') options.complete({})
    }
    wxRef.showActionSheet = function (options = {}) {
      state.actionSheets.push({ itemList: options.itemList || [] })
      if (typeof options.success === 'function') options.success({ tapIndex: 0 })
      if (typeof options.complete === 'function') options.complete({})
    }
    wxRef.showLoading = function (options = {}) {
      state.loadings.push(options.title || '')
      if (typeof options.success === 'function') options.success({})
    }
    wxRef.hideLoading = function () {}
    wxRef.stopPullDownRefresh = function () {
      state.pullDownStopped += 1
    }
    wxRef.getAccountInfoSync = function () {
      return { miniProgram: { envVersion: 'develop' } }
    }
    if (!wxRef.cloud) wxRef.cloud = {}
    wxRef.cloud.init = function () {}
    wxRef.cloud.callFunction = function (options = {}) {
      const name = options.name || ''
      const data = options.data || {}
      const now = new Date().toISOString()
      const student = {
        _id: 's1',
        name: '声声',
        parent_name: '家长',
        parent_phone: '13800000000',
        parent_openid: 'parent_openid',
        status: 'active',
        tags: ['试唱'],
        total_attended: 6,
        owner_teacher_id: 't_admin',
        owner_teacher_openid: 'admin_openid',
        owner_teacher_name: '管理员',
        teacher_ids: ['t_admin']
      }
      const pkg = {
        _id: 'p1',
        name: '朱哥课程',
        unit_price: 200,
        duration_min: 45,
        type: '1v1',
        is_active: true,
        created_at: now
      }
      const schedule = {
        _id: 'sch1',
        student_ids: ['s1'],
        package_id: 'p1',
        class_type: 'one_to_one',
        class_type_label: '一对一',
        class_display: '一对一',
        delivery_mode: 'offline',
        delivery_mode_label: '线下课',
        teacher_id: 't_admin',
        teacher_name: '管理员',
        start_time: '2099-01-01 10:00',
        end_time: '2099-01-01 10:45',
        time_str: '10:00',
        duration_text: '45分钟',
        duration_min: 45,
        classroom: '一号教室',
        status: 'pending',
        status_label: '待上',
        student_names: '声声'
      }
      const feedback = {
        _id: 'f1',
        schedule_id: 'sch1',
        student_id: 's1',
        teacher_id: 't_admin',
        teacher_name: '管理员',
        ratings: { breath: 4 },
        comment: '状态不错',
        audio_files: [],
        created_at: now
      }
      const detail = {
        student,
        balances: [{
          _id: 'b1',
          student_id: 's1',
          package_id: 'p1',
          package_name: '朱哥课程',
          total_purchased: 20,
          total_used: 1,
          remaining: 19
        }],
        orders: [{
          _id: 'o1',
          student_id: 's1',
          package_id: 'p1',
          package_name: '朱哥课程',
          amount: 1200,
          course_count: 20,
          pay_date: '2026-06-17',
          pay_method: '微信',
          created_at: now
        }],
        feedbacks: [feedback],
        isAdmin: true
      }
      const map = {
        cm_login: { openid: 'admin_openid' },
        cm_checkRole: { success: true, role: 'teacher', roleLabel: '校长/管理员', userInfo: { _id: 't_admin', openid: 'admin_openid', name: '管理员', is_admin: true } },
        cm_stats: {
          success: true,
          data: {
            isAdmin: true,
            todayPending: 1,
            todayLessonCount: 1,
            todayTotalMinutes: 45,
            todayTotalMinutesText: '45分钟',
            monthAttendance: 8,
            monthIncome: 1200,
            monthIncome_str: '¥1,200',
            warningCount: 1,
            warningList: [{ _id: 's1', name: '声声', remaining: 2 }],
            todaySchedules: [schedule]
          }
        },
        cm_getStudents: { success: true, data: [student], isAdmin: true },
        cm_getSchedules: { success: true, data: data.scheduleId ? schedule : [schedule] },
        cm_getPackages: { success: true, data: [pkg], isAdmin: true },
        cm_getTeachers: { success: true, data: [{ _id: 't_admin', openid: 'admin_openid', name: '管理员', phone: '13800000000', is_admin: true }], isAdmin: true, currentTeacherId: 't_admin' },
        cm_batchBalance: { success: true, data: { totals: { s1: 19 }, byPackage: { s1: { p1: 19 } }, paidByPackage: { s1: { p1: 20 } } } },
        cm_getStudentDetail: { success: true, data: detail },
        cm_createSchedule: { success: true, message: '排课成功', count: 1 },
        cm_checkin: { success: true, message: '点名成功' },
        cm_undoCheckin: { success: true, message: '撤销成功，课时已恢复' },
        cm_saveFeedback: { success: true, message: '反馈已保存', feedbackId: 'f1' },
        cm_createOrder: { success: true, message: '缴费已登记', orderId: 'o1' },
        cm_updateTeacher: { success: true, message: '更新成功' },
        cm_generateInviteCode: { success: true, code: 'a1b2c3d4', expires_at: '2099-01-02T00:00:00.000Z' },
        cm_getStudentAuditLogs: { success: true, data: [{ _id: 'log1', action: 'create', teacher_name: '管理员', student_name: '声声', created_at: now }] },
        cm_addPackage: { success: true, message: '添加成功', packageId: 'p1' },
        cm_updatePackage: { success: true, message: '更新成功' },
        cm_updateStudent: { success: true, message: '已更新' },
        cm_deleteStudent: { success: true, message: '学员已删除' },
        cm_bindParent: { success: true, message: '绑定成功' },
        cm_submitLeave: { success: true, message: '请假已提交' },
        cm_getParentData: data.action === 'orders'
          ? { success: false, message: '当前账号不能查看此页面', code: 403 }
          : {
              success: true,
              data: data.action === 'feedbackDetail'
                ? { feedback, scheduleInfo: schedule }
                : data.action === 'profile'
                  ? { student }
                  : data.action === 'schedules'
                    ? [schedule]
                    : data.action === 'feedbacks'
                      ? [feedback]
                      : {
                          student,
                          balances: detail.balances,
                          totalRemaining: 19,
                          upcomingSchedules: [schedule],
                          latestFeedback: feedback
                        }
            }
      }
      const result = map[name] || { success: true, data: null }
      const response = { result }
      if (result && result.success === false) {
        if (typeof options.success === 'function') options.success(response)
        if (typeof options.complete === 'function') options.complete(response)
        return Promise.resolve(response)
      }
      if (typeof options.success === 'function') options.success(response)
      if (typeof options.complete === 'function') options.complete(response)
      return Promise.resolve(response)
    }
  })
}

async function currentPath(miniProgram) {
  const page = await miniProgram.currentPage()
  return page ? page.path : ''
}

const TAB_PAGES = new Set([
  'pages/teacher/home/home',
  'pages/teacher/calendar/calendar',
  'pages/teacher/students/students',
  'pages/teacher/profile/profile'
])

function normalizePath(pathValue) {
  return String(pathValue || '').replace(/^\//, '').split('?')[0]
}

async function openPage(miniProgram, url) {
  await ensureTestState(miniProgram)
  const normalized = normalizePath(url)
  const page = TAB_PAGES.has(normalized)
    ? await miniProgram.switchTab(`/${normalized}`)
    : await miniProgram.reLaunch(url)
  await wait(800)
  await ensureTestState(miniProgram)
  return page
}

async function expectCurrentPath(miniProgram, expected) {
  await wait(1200)
  const actual = normalizePath(await currentPath(miniProgram))
  const want = normalizePath(expected)
  if (actual !== want) throw new Error(`expected route ${want}, got ${actual}`)
}

async function ensureTestState(miniProgram) {
  const ok = await miniProgram.evaluate(() => {
    if (!globalThis.__TEST_STATE__) return false
    if (!Array.isArray(globalThis.__TEST_STATE__.toasts)) return false
    return true
  }).catch(() => false)
  if (!ok) await setupWxMocks(miniProgram)
}

async function getTestState(miniProgram) {
  await ensureTestState(miniProgram)
  const text = await miniProgram.evaluate(() => JSON.stringify(globalThis.__TEST_STATE__ || {}))
  return text ? JSON.parse(text) : {}
}

async function resetTestState(miniProgram) {
  await ensureTestState(miniProgram)
  await miniProgram.evaluate(() => {
    if (!globalThis.__TEST_STATE__) return
    for (const key of Object.keys(globalThis.__TEST_STATE__)) {
      if (Array.isArray(globalThis.__TEST_STATE__[key])) globalThis.__TEST_STATE__[key] = []
    }
    globalThis.__TEST_STATE__.pullDownStopped = 0
  })
}

async function screenshot(miniProgram, name) {
  await miniProgram.screenshot({ path: path.join(outDir, `${name}.png`) })
}

async function setTeacherAppState(miniProgram, isAdmin = true) {
  await miniProgram.evaluate((admin) => {
    const app = getApp()
    app.globalData.openid = admin ? 'admin_openid' : 'teacher_openid'
    app.globalData.role = 'teacher'
    app.globalData.userInfo = {
      _id: admin ? 't_admin' : 't_teacher',
      openid: admin ? 'admin_openid' : 'teacher_openid',
      name: admin ? '管理员' : '普通老师',
      phone: '13800000000',
      is_admin: admin
    }
    app.checkRole = function (options = {}) {
      if (options.ignoreSwitch && this.globalData._switchedFromTeacher) {
        this.globalData._switchedFromTeacher = false
        this.globalData._originalTeacherInfo = null
      }
      return Promise.resolve('teacher')
    }
  }, isAdmin)
}

async function setParentAppState(miniProgram, switched = false) {
  await miniProgram.evaluate((isSwitched) => {
    const app = getApp()
    app.globalData.openid = isSwitched ? 'admin_openid' : 'parent_openid'
    app.globalData.role = 'parent'
    app.globalData.userInfo = {
      _id: 's1',
      name: '声声',
      parent_phone: '13800000000',
      total_attended: 6
    }
    app.globalData._switchedFromTeacher = isSwitched
    app.globalData._originalTeacherInfo = isSwitched ? {
      _id: 't_admin',
      openid: 'admin_openid',
      name: '管理员',
      is_admin: true
    } : null
    app.checkRole = function () { return Promise.resolve('parent') }
  }, switched)
}

async function injectTeacherHome(page, isAdmin = true) {
  await page.setData({
    loading: false,
    stats: {
      todayLessonCount: 1,
      todayTotalMinutesText: '45分钟',
      todayPending: 1,
      warningCount: 1,
      monthAttendance: 8,
      monthIncome_str: '¥1,200',
      todayTotalMinutes: 45
    },
    isAdmin,
    todaySchedules: [{
      _id: 'sch1',
      status: 'pending',
      time_str: '18:30',
      student_names: '声声',
      class_display: '一对一',
      duration_text: '45分钟',
      teacher_name: '管理员',
      delivery_mode_label: '线下课'
    }],
    warningList: [{ _id: 's1', name: '声声', remaining: 2 }]
  })
}

async function injectCalendar(page, isAdmin = true) {
  await page.setData({
    loading: false,
    selectedDate: '2026-06-17',
    selectedDateLabel: '今天 周三',
    weekInfo: {
      start: '2026-06-15',
      end: '2026-06-21',
      days: [
        { date: '2026-06-17', weekday: '周三', day: '17', isToday: true }
      ]
    },
    groupedSchedules: {
      '2026-06-17': [{
        _id: 'sch1',
        status: 'pending',
        status_label: '待上',
        time_str: '18:30',
        student_names: '声声',
        class_display: '一对一',
        duration_text: '45分钟',
        delivery_mode_label: '线下课',
        teacher_name: '管理员',
        classroom: '一号教室'
      }]
    },
    students: [{ _id: 's1', name: '声声', remaining: 19, checked: false }],
    allPackages: [{ _id: 'p1', name: '朱哥课程', is_active: true, displayName: '朱哥课程' }],
    balanceByPackage: { s1: { p1: 19 } },
    packages: [],
    selectedStudents: [],
    packageId: '',
    packageIndex: -1,
    teachers: [{ _id: 't_admin', name: '管理员' }],
    teacherId: 't_admin',
    teacherIndex: 0,
    teacherName: '管理员',
    isAdmin,
    startDate: '2099-01-01',
    startTime: '10:00',
    showCreateModal: false,
    submitting: false
  })
}

async function injectStudents(page, isAdmin = true) {
  await page.setData({
    loading: false,
    isAdmin,
    stats: { active: 1, archived: 0 },
    students: [{
      _id: 's1',
      name: '声声',
      parent_phone: '13800000000',
      status: 'active',
      tags: ['试唱'],
      remaining: 19,
      owner_teacher_name: '管理员'
    }],
    filteredStudents: [{
      _id: 's1',
      name: '声声',
      parent_phone: '13800000000',
      status: 'active',
      tags: ['试唱'],
      remaining: 19,
      owner_teacher_name: '管理员'
    }],
    allTags: ['试唱']
  })
}

async function injectStudentDetail(page, isAdmin = true) {
  await page.setData({
    loading: false,
    isAdmin,
    student: { _id: 's1', name: '声声', parent_phone: '13800000000', status: 'active', total_attended: 6 },
    studentName: '声声',
    avatarText: '声',
    studentPhone: '13800000000',
    statusClass: 'active',
    statusText: '在读',
    totalAttended: 6,
    totalRemaining: 19,
    totalFeedbackCount: 1,
    totalPaidText: '¥1,200',
    balances: [{ _id: 'b1', packageNameText: '朱哥课程', remainingText: '19节', detailText: '已购 20 · 已用 1' }],
    orders: isAdmin ? [{ _id: 'o1', payDateText: '2026-06-17', amountText: '¥1,200', courseCountText: '+20节' }] : [],
    feedbacks: [{ _id: 'f1', scheduleId: 'sch1', dateText: '2026-06-17 18:30', commentPreview: '状态不错' }]
  })
}

async function injectCheckin(page) {
  await page.setData({
    loading: false,
    schedule: { _id: 'sch1', package_id: 'p1', status: 'pending' },
    students: [{
      _id: 's1',
      name: '声声',
      usableRemaining: 19,
      remaining: 19,
      totalRemaining: 19,
      checkinStatus: 'present',
      deductCount: 1,
      balanceTag: '本包余 19节'
    }],
    balanceReady: true,
    deductCount: 1,
    showConfirmSheet: false,
    submitting: false
  })
}

async function injectFeedback(page) {
  await page.setData({
    loading: false,
    scheduleId: 'sch1',
    schedule: { _id: 'sch1', status: 'done', student_ids: ['s1'] },
    students: [{ _id: 's1', name: '声声' }],
    selectedStudentId: 's1',
    currentStudent: { _id: 's1', name: '声声' },
    ratings: { breath: 0, pronunciation: 0, rhythm: 0, emotion: 0, confidence: 0 },
    comment: '',
    audioFiles: [],
    uploading: false,
    saving: false
  })
}

async function injectPayment(page) {
  await page.setData({
    loading: false,
    isAdmin: true,
    students: [{ _id: 's1', name: '声声' }],
    packages: [{ _id: 'p1', name: '朱哥课程', unit_price: 200 }],
    selectedStudentIndex: 0,
    selectedPackageIndex: 0,
    studentId: 's1',
    courseCount: '',
    amount: '',
    payDate: '2026-06-17',
    payMethod: '微信',
    currentRemaining: 19,
    previewRemaining: 19,
    totalPaidText: '¥1,200',
    previewTotalPaidText: '¥1,200',
    submitting: false
  })
}

async function injectProfile(page, isAdmin = true) {
  await page.setData({
    loading: false,
    teacher: { _id: 't_admin', name: '管理员', phone: '13800000000', is_admin: isAdmin },
    name: '管理员',
    phone: '13800000000',
    isAdmin,
    showDevTools: isAdmin,
    teachers: [{ _id: 't_admin', name: '管理员', roleText: '校长/管理员', phoneText: '13800000000', isAdminRole: true }],
    auditLogs: [{ _id: 'log1', teacherText: '管理员', actionText: '新增', studentText: '声声', timeText: '2026-06-17 10:00', action: 'create' }],
    packages: [{ _id: 'p1', name: '朱哥课程', unit_price: 200, duration_min: 45, type: '1v1', is_active: true }],
    switchStudents: [{ _id: 's1', name: '声声', parent_phone: '13800000000' }],
    submitting: false,
    showParentSwitchModal: false,
    showPackageForm: false
  })
}

async function injectParentHome(page) {
  await page.setData({
    loading: false,
    student: { _id: 's1', name: '声声', total_attended: 6 },
    studentName: '声声',
    avatarText: '声',
    totalRemaining: 19,
    totalAttended: 6,
    balanceCards: [{ _id: 'b1', packageNameText: '朱哥课程', remainingText: '19节', usedText: '1节', purchasedText: '20节' }],
    hasBalances: true,
    upcomingSchedules: [{ _id: 'sch1', startTimeText: '2026-06-18 18:30', metaText: '一对一 · 45分钟', teacherText: '授课老师：管理员', classroomText: '一号教室' }],
    latestFeedback: { _id: 'f1', schedule_id: 'sch1', comment: '状态不错', audio_files: [] },
    latestFeedbackDateText: '2026-06-17 18:30',
    latestFeedbackPreview: '状态不错',
    hasAudio: false
  })
}

async function main() {
  const miniProgram = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath,
    timeout: 60000,
    trustProject: true
  })
  miniProgram.on('exception', err => {
    record('runtime exception', false, JSON.stringify(err))
  })
  miniProgram.on('console', msg => {
    const text = JSON.stringify(msg)
    if (/TypeError|ReferenceError|SyntaxError|Unhandled|未捕获|Cannot read/.test(text)) {
      record('console error', false, text)
    }
  })

  try {
    await setupWxMocks(miniProgram)
    await setTeacherAppState(miniProgram, true)

    await withStep('teacher home buttons navigate', async () => {
      let page = await openPage(miniProgram, '/pages/teacher/home/home')
      await wait(600)
      await injectTeacherHome(page, true)
      await screenshot(miniProgram, 'teacher-home')
      await page.callMethod('goCalendar')
      await expectCurrentPath(miniProgram, '/pages/teacher/calendar/calendar')

      page = await openPage(miniProgram, '/pages/teacher/home/home')
      await wait(600)
      await injectTeacherHome(page, true)
      await page.callMethod('goStudents')
      await expectCurrentPath(miniProgram, '/pages/teacher/students/students')

      page = await openPage(miniProgram, '/pages/teacher/home/home')
      await wait(600)
      await injectTeacherHome(page, true)
      await page.callMethod('goCheckin', { currentTarget: { dataset: { id: 'sch1' } } })
      await expectCurrentPath(miniProgram, '/pages/teacher/checkin/checkin')

      page = await openPage(miniProgram, '/pages/teacher/home/home')
      await wait(600)
      await injectTeacherHome(page, true)
      await page.callMethod('goFeedback', { currentTarget: { dataset: { id: 'sch1' } } })
      await expectCurrentPath(miniProgram, '/pages/teacher/feedback/feedback')

      page = await openPage(miniProgram, '/pages/teacher/home/home')
      await wait(600)
      await injectTeacherHome(page, true)
      await page.callMethod('goStudentDetail', { currentTarget: { dataset: { id: 's1' } } })
      await expectCurrentPath(miniProgram, '/pages/teacher/students/detail')
    })

    await withStep('calendar create modal validation and routes', async () => {
      let page = await openPage(miniProgram, '/pages/teacher/calendar/calendar')
      await wait(600)
      await injectCalendar(page, true)
      await screenshot(miniProgram, 'calendar')
      await resetTestState(miniProgram)
      await page.callMethod('showCreate')
      await wait(200)
      let data = await page.data()
      if (!data.showCreateModal) throw new Error('create modal not shown')
      await resetTestState(miniProgram)
      await page.callMethod('onCreateSchedule')
      let state = await getTestState(miniProgram)
      if (!state.toasts.some(t => t.title.includes('请选择学员'))) throw new Error('empty create did not prompt student')
      await page.callMethod('onStudentToggle', { currentTarget: { dataset: { id: 's1' } } })
      data = await page.data()
      if (!data.packages.length || data.packageId !== 'p1') throw new Error('package not auto available after student select')
      await page.callMethod('goCheckin', { currentTarget: { dataset: { id: 'sch1' } } })
      await expectCurrentPath(miniProgram, '/pages/teacher/checkin/checkin')

      page = await openPage(miniProgram, '/pages/teacher/calendar/calendar')
      await wait(600)
      await injectCalendar(page, true)
      await page.callMethod('goFeedback', { currentTarget: { dataset: { id: 'sch1' } } })
      await expectCurrentPath(miniProgram, '/pages/teacher/feedback/feedback')
      await screenshot(miniProgram, 'calendar-create-modal')
    })

    await withStep('students list and detail actions', async () => {
      let page = await openPage(miniProgram, '/pages/teacher/students/students')
      await wait(600)
      await injectStudents(page, true)
      await screenshot(miniProgram, 'students')
      await resetTestState(miniProgram)
      await page.callMethod('goAdd')
      await expectCurrentPath(miniProgram, '/pages/teacher/students/add')

      page = await openPage(miniProgram, '/pages/teacher/students/students')
      await wait(600)
      await injectStudents(page, true)
      await page.callMethod('goDetail', { currentTarget: { dataset: { id: 's1' } } })
      await expectCurrentPath(miniProgram, '/pages/teacher/students/detail')
    })

    await withStep('student detail admin and teacher money visibility', async () => {
      let page = await openPage(miniProgram, '/pages/teacher/students/detail?id=s1')
      await wait(600)
      await injectStudentDetail(page, true)
      await resetTestState(miniProgram)
      await page.callMethod('goPayment')
      await expectCurrentPath(miniProgram, '/pages/teacher/payment/payment')

      page = await openPage(miniProgram, '/pages/teacher/students/detail?id=s1')
      await wait(600)
      await injectStudentDetail(page, true)
      await page.callMethod('goAllOrders')
      await expectCurrentPath(miniProgram, '/pages/parent/payment-list/payment-list')

      page = await openPage(miniProgram, '/pages/teacher/students/detail?id=s1')
      await wait(600)
      await injectStudentDetail(page, true)
      await page.callMethod('goAllFeedbacks')
      await expectCurrentPath(miniProgram, '/pages/teacher/students/feedbacks')

      page = await openPage(miniProgram, '/pages/teacher/students/detail?id=s1')
      await wait(600)
      await injectStudentDetail(page, false)
      const wxml = await (await page.$('.container')).wxml()
      if (/累计缴费|最近缴费|登记缴费/.test(wxml)) throw new Error('ordinary teacher sees financial labels')
      await resetTestState(miniProgram)
      await page.callMethod('goPayment')
      const state = await getTestState(miniProgram)
      if (!state.toasts.some(t => /管理员|校长/.test(t.title))) throw new Error('ordinary teacher payment not blocked')
    })

    await withStep('checkin confirm sheet and validation', async () => {
      const page = await openPage(miniProgram, '/pages/teacher/checkin/checkin?scheduleId=sch1')
      await wait(600)
      await injectCheckin(page)
      await screenshot(miniProgram, 'checkin')
      await page.callMethod('onConfirm')
      let data = await page.data()
      if (!data.showConfirmSheet) throw new Error('confirm sheet not shown')
      await page.callMethod('hideConfirmSheet')
      data = await page.data()
      if (data.showConfirmSheet) throw new Error('confirm sheet did not hide')
    })

    await withStep('feedback validation prevents empty save', async () => {
      const page = await openPage(miniProgram, '/pages/teacher/feedback/feedback?scheduleId=sch1')
      await wait(600)
      await injectFeedback(page)
      await screenshot(miniProgram, 'feedback')
      await resetTestState(miniProgram)
      await page.callMethod('saveCurrentFeedback')
      const state = await getTestState(miniProgram)
      if (!state.toasts.some(t => t.title.includes('至少完成一项评分'))) throw new Error('empty feedback save not blocked')
    })

    await withStep('payment admin validation and ordinary teacher block', async () => {
      let page = await openPage(miniProgram, '/pages/teacher/payment/payment?studentId=s1')
      await wait(600)
      await injectPayment(page)
      await screenshot(miniProgram, 'payment')
      await resetTestState(miniProgram)
      await page.callMethod('onSave')
      let state = await getTestState(miniProgram)
      if (!state.toasts.some(t => t.title.includes('请填写完整信息'))) throw new Error('empty payment save not blocked')

      page = await openPage(miniProgram, '/pages/teacher/payment/payment?studentId=s1')
      await wait(600)
      await page.setData({ loading: false, isAdmin: false, students: [], packages: [] })
      await resetTestState(miniProgram)
      await page.callMethod('onSave')
      state = await getTestState(miniProgram)
      if (!state.toasts.some(t => /管理员|校长/.test(t.title))) throw new Error('ordinary teacher payment save not blocked')
    })

    await withStep('profile admin controls and parent switch modal', async () => {
      const page = await openPage(miniProgram, '/pages/teacher/profile/profile')
      await wait(600)
      await injectProfile(page, true)
      await screenshot(miniProgram, 'profile')
      await resetTestState(miniProgram)
      await page.callMethod('onSwitchToParent')
      let data = await page.data()
      if (!data.showParentSwitchModal) throw new Error('parent switch modal not shown')
      await page.callMethod('onSelectParentStudent', { currentTarget: { dataset: { index: 0 } } })
      await expectCurrentPath(miniProgram, '/pages/parent/home/home')
    })

    await withStep('parent home actions and no financial text', async () => {
      await setParentAppState(miniProgram, true)
      let page = await openPage(miniProgram, '/pages/parent/home/home')
      await wait(600)
      await injectParentHome(page)
      await screenshot(miniProgram, 'parent-home')
      const wxml = await (await page.$('.container')).wxml()
      if (/资金余额|剩余课费|累计缴费|已购课时/.test(wxml)) throw new Error('parent home shows financial labels')
      await resetTestState(miniProgram)
      await page.callMethod('goLeave')
      await expectCurrentPath(miniProgram, '/pages/parent/leave/leave')

      page = await openPage(miniProgram, '/pages/parent/home/home')
      await wait(600)
      await injectParentHome(page)
      await page.callMethod('goRecords')
      await expectCurrentPath(miniProgram, '/pages/parent/records/records')

      page = await openPage(miniProgram, '/pages/parent/home/home')
      await wait(600)
      await injectParentHome(page)
      await page.callMethod('goPaymentList')
      let state = await getTestState(miniProgram)
      if (!state.toasts.some(t => t.title.includes('请联系老师'))) throw new Error('parent payment list not blocked')

      page = await openPage(miniProgram, '/pages/parent/home/home')
      await wait(600)
      await injectParentHome(page)
      await page.callMethod('goFeedbackDetail')
      await expectCurrentPath(miniProgram, '/pages/parent/feedback-detail/feedback-detail')
    })

    const failed = results.filter(r => !r.ok)
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2))
    if (failed.length) {
      throw new Error(`${failed.length} click smoke checks failed`)
    }
  } finally {
    await miniProgram.close().catch(() => {})
  }
}

main().catch(err => {
  console.error(err && (err.stack || err.message) || err)
  process.exit(1)
})
