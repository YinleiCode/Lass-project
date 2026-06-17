const path = require('path')
const fs = require('fs')

const automator = require('/private/tmp/miniprogram-automator.Q5iUfa/node_modules/miniprogram-automator')

const projectPath = path.resolve(__dirname, '..')
const outDir = path.join(projectPath, 'preview', 'automator-button-regression-latest')
fs.mkdirSync(outDir, { recursive: true })

const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const NATIVE_TABS = new Set([
  'pages/teacher/home/home',
  'pages/teacher/calendar/calendar',
  'pages/teacher/students/students',
  'pages/teacher/profile/profile'
])

const results = []
const scenarioFilter = (process.env.SCENARIO || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

function normalizePath(url) {
  return String(url || '').replace(/^\//, '').split('?')[0]
}

function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

function trace(label) {
  if (process.env.TRACE) console.log(`TRACE ${label}`)
}

function wait(ms = 250) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withStep(name, fn) {
  try {
    const detail = await fn()
    record(name, true, detail || '')
  } catch (err) {
    record(name, false, (err && (err.stack || err.message)) || String(err))
  }
}

async function launch() {
  const miniProgram = await automator.launch({
    cliPath: CLI_PATH,
    projectPath,
    port: 19190,
    timeout: 60000,
    trustProject: true
  })
  await installStableMocks(miniProgram)
  await setRole(miniProgram, 'teacher', true)
  await wait(1800)
  await resetState(miniProgram)
  return miniProgram
}

async function installStableMocks(miniProgram) {
  await miniProgram.evaluate(() => {
    const state = {
      toasts: [],
      modals: [],
      actionSheets: [],
      navigations: [],
      loadings: [],
      pullDownStopped: 0
    }
    globalThis.__BUTTON_TEST_STATE__ = state

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
      if (typeof options.complete === 'function') options.complete({})
    }
    wxRef.hideLoading = function () {}
    wxRef.stopPullDownRefresh = function () {
      state.pullDownStopped += 1
    }
    wxRef.navigateBack = function (options = {}) {
      state.navigations.push({ type: 'navigateBack', url: '' })
      if (typeof options.success === 'function') options.success({})
      if (typeof options.complete === 'function') options.complete({})
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
        access_teacher_names: ['管理员'],
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
        package_name: '朱哥课程',
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
        created_at: now,
        schedule_time: schedule.start_time,
        package_name: pkg.name
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
        cm_checkRole: { success: true, role: 'teacher', userInfo: { _id: 't_admin', openid: 'admin_openid', name: '管理员', phone: '13800000000', is_admin: true } },
        cm_stats: { success: true, data: { isAdmin: true, todayLessonCount: 1, todayTotalMinutesText: '45分钟', todayPending: 1, warningCount: 1, monthAttendance: 8, monthIncome_str: '¥1,200', todaySchedules: [schedule], warningList: [student] } },
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
        cm_bindParent: { success: true, message: '绑定成功', student },
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
                      : { student, balances: detail.balances, totalRemaining: 19, upcomingSchedules: [schedule], latestFeedback: feedback }
            }
      }
      const result = map[name] || { success: true, data: null }
      const response = { result }
      if (typeof options.success === 'function') options.success(response)
      if (typeof options.complete === 'function') options.complete(response)
      return Promise.resolve(response)
    }
  })
}

async function ensureState(miniProgram) {
  const ok = await miniProgram.evaluate(() => !!globalThis.__BUTTON_TEST_STATE__).catch(() => false)
  if (!ok) await installStableMocks(miniProgram)
}

async function resetState(miniProgram) {
  await ensureState(miniProgram)
  await miniProgram.evaluate(() => {
    const state = globalThis.__BUTTON_TEST_STATE__
    Object.keys(state).forEach(key => {
      if (Array.isArray(state[key])) state[key] = []
    })
    state.pullDownStopped = 0
  })
}

async function getState(miniProgram) {
  await ensureState(miniProgram)
  const json = await miniProgram.evaluate(() => JSON.stringify(globalThis.__BUTTON_TEST_STATE__))
  return JSON.parse(json)
}

async function setRole(miniProgram, role, isAdmin = true) {
  await miniProgram.evaluate((roleValue, adminValue) => {
    const app = getApp()
    if (roleValue === 'parent') {
      app.globalData.openid = adminValue ? 'admin_openid' : 'parent_openid'
      app.globalData.role = 'parent'
      app.globalData.userInfo = { _id: 's1', name: '声声', parent_phone: '13800000000', total_attended: 6 }
      app.globalData._switchedFromTeacher = adminValue
      app.globalData._originalTeacherInfo = adminValue ? { _id: 't_admin', openid: 'admin_openid', name: '管理员', is_admin: true } : null
      app.checkRole = function () { return Promise.resolve('parent') }
      return
    }
    app.globalData.openid = adminValue ? 'admin_openid' : 'teacher_openid'
    app.globalData.role = 'teacher'
    app.globalData.userInfo = { _id: adminValue ? 't_admin' : 't_teacher', openid: adminValue ? 'admin_openid' : 'teacher_openid', name: adminValue ? '管理员' : '普通老师', phone: '13800000000', is_admin: adminValue }
    app.globalData._switchedFromTeacher = false
    app.globalData._originalTeacherInfo = null
    app.checkRole = function (options = {}) {
      if (options.ignoreSwitch && this.globalData._switchedFromTeacher) {
        this.globalData._switchedFromTeacher = false
        this.globalData._originalTeacherInfo = null
      }
      return Promise.resolve('teacher')
    }
  }, role, isAdmin)
}

async function openPage(miniProgram, url) {
  const normalized = normalizePath(url)
  if (NATIVE_TABS.has(normalized)) {
    await miniProgram.switchTab(`/${normalized}`)
  } else if (normalized.startsWith('pages/teacher/')) {
    const baseTab = normalized.startsWith('pages/teacher/students/')
      ? '/pages/teacher/students/students'
      : normalized.startsWith('pages/teacher/calendar') || normalized.startsWith('pages/teacher/checkin') || normalized.startsWith('pages/teacher/feedback')
        ? '/pages/teacher/calendar/calendar'
        : '/pages/teacher/home/home'
    await miniProgram.switchTab(baseTab)
    await wait(300)
    await miniProgram.navigateTo(url)
  } else {
    await miniProgram.reLaunch(url)
  }
  await wait(800)
  await ensureState(miniProgram)
  const actual = await currentPath(miniProgram)
  if (actual !== normalized) throw new Error(`openPage expected ${normalized}, got ${actual}`)
  return miniProgram.currentPage()
}

async function currentPath(miniProgram) {
  const page = await miniProgram.currentPage()
  return normalizePath(page && page.path)
}

async function expectPath(miniProgram, expected) {
  await wait(600)
  const actual = await currentPath(miniProgram)
  const want = normalizePath(expected)
  if (actual !== want) throw new Error(`expected ${want}, got ${actual}`)
}

async function expectToast(miniProgram, pattern) {
  const state = await getState(miniProgram)
  const found = state.toasts.some(t => pattern.test(t.title))
  if (!found) throw new Error(`toast not found: ${pattern}; got ${JSON.stringify(state.toasts)}`)
}

async function screenshot(miniProgram, name) {
  await miniProgram.screenshot({ path: path.join(outDir, `${name}.png`) })
}

async function runScenario(miniProgram, name, role, isAdmin, fn) {
  if (scenarioFilter.length && !scenarioFilter.includes(name)) return
  await withStep(name, async () => {
    await setRole(miniProgram, role, isAdmin)
    await wait(1400)
    await resetState(miniProgram)
    return await fn(miniProgram)
  })
}

async function main() {
  const miniProgram = await launch()
  try {
  await runScenario(miniProgram, 'teacher home core buttons', 'teacher', true, async (miniProgram) => {
    let page = await openPage(miniProgram, '/pages/teacher/home/home')
    await page.callMethod('goCalendar')
    await expectPath(miniProgram, '/pages/teacher/calendar/calendar')

    page = await openPage(miniProgram, '/pages/teacher/home/home')
    await page.callMethod('goStudents')
    await expectPath(miniProgram, '/pages/teacher/students/students')

    page = await openPage(miniProgram, '/pages/teacher/home/home')
    await page.callMethod('goCheckin', { currentTarget: { dataset: { id: '' } } })
    await expectToast(miniProgram, /课程数据不完整/)

    page = await openPage(miniProgram, '/pages/teacher/home/home')
    await page.callMethod('goFeedback', { currentTarget: { dataset: { id: '' } } })
    await expectToast(miniProgram, /课程数据不完整/)

    page = await openPage(miniProgram, '/pages/teacher/home/home')
    await page.callMethod('goStudentDetail', { currentTarget: { dataset: { id: '' } } })
    await expectToast(miniProgram, /学员数据不完整/)
    await screenshot(miniProgram, 'teacher-home')
  })

  await runScenario(miniProgram, 'calendar create and schedule buttons', 'teacher', true, async (miniProgram) => {
    const page = await openPage(miniProgram, '/pages/teacher/calendar/calendar')
    await page.callMethod('showCreate')
    await wait(500)
    let data = await page.data()
    if (!data.showCreateModal) throw new Error('create modal not shown')
    await page.callMethod('onCreateSchedule')
    await expectToast(miniProgram, /请选择学员/)
    await page.callMethod('goCheckin', { currentTarget: { dataset: { id: '' } } })
    await expectToast(miniProgram, /课程数据不完整/)
    await page.callMethod('goFeedback', { currentTarget: { dataset: { id: '' } } })
    await expectToast(miniProgram, /课程数据不完整/)
    await screenshot(miniProgram, 'calendar')
  })

  await runScenario(miniProgram, 'students list add button', 'teacher', true, async (miniProgram) => {
    trace('students open list')
    let page = await openPage(miniProgram, '/pages/teacher/students/students')
    trace('students go add')
    await page.callMethod('goAdd')
    await expectPath(miniProgram, '/pages/teacher/students/add')
  })

  await runScenario(miniProgram, 'students detail navigation buttons', 'teacher', true, async (miniProgram) => {
    trace('students open list detail scenario')
    let page = await openPage(miniProgram, '/pages/teacher/students/students')
    trace('students go detail')
    await page.callMethod('goDetail', { currentTarget: { dataset: { id: 's1' } } })
    await expectPath(miniProgram, '/pages/teacher/students/detail')
  })

  await runScenario(miniProgram, 'student detail payment button', 'teacher', true, async (miniProgram) => {
    trace('students open detail payment')
    let page = await openPage(miniProgram, '/pages/teacher/students/detail?id=s1')
    trace('students call goPayment')
    await page.callMethod('goPayment')
    await expectPath(miniProgram, '/pages/teacher/payment/payment')
  })

  await runScenario(miniProgram, 'student detail feedbacks button', 'teacher', true, async (miniProgram) => {
    trace('students open detail feedbacks')
    let page = await openPage(miniProgram, '/pages/teacher/students/detail?id=s1')
    trace('students call goAllFeedbacks')
    await page.callMethod('goAllFeedbacks')
    await expectPath(miniProgram, '/pages/teacher/students/feedbacks')
    trace('students screenshot')
    await screenshot(miniProgram, 'students-detail')
  })

  await runScenario(miniProgram, 'ordinary teacher cannot touch money', 'teacher', false, async (miniProgram) => {
    const page = await openPage(miniProgram, '/pages/teacher/students/detail?id=s1')
    await page.setData({ loading: false, isAdmin: false, student: { _id: 's1', name: '声声' }, orders: [] })
    await page.callMethod('goPayment')
    await expectToast(miniProgram, /仅校长\/管理员可操作/)
  })

  await runScenario(miniProgram, 'checkin validation and confirm sheet', 'teacher', true, async (miniProgram) => {
    const page = await openPage(miniProgram, '/pages/teacher/checkin/checkin?scheduleId=sch1')
    await page.setData({
      loading: false,
      schedule: { _id: 'sch1', package_id: 'p1', status: 'pending' },
      students: [{ _id: 's1', name: '声声', usableRemaining: 19, remaining: 19, totalRemaining: 19, checkinStatus: 'present', deductCount: 1, balanceTag: '本包余 19节' }],
      balanceReady: true,
      deductCount: 1,
      showConfirmSheet: false,
      submitting: false
    })
    await page.callMethod('onConfirm')
    const data = await page.data()
    if (!data.showConfirmSheet) throw new Error('confirm sheet not shown')
    await page.callMethod('hideConfirmSheet')
    if ((await page.data()).showConfirmSheet) throw new Error('confirm sheet did not hide')
    await screenshot(miniProgram, 'checkin')
  })

  await runScenario(miniProgram, 'feedback blocks empty save and templates work', 'teacher', true, async (miniProgram) => {
    const page = await openPage(miniProgram, '/pages/teacher/feedback/feedback?scheduleId=sch1')
    await page.setData({
      loading: false,
      scheduleId: 'sch1',
      schedule: { _id: 'sch1', student_ids: ['s1'] },
      students: [{ _id: 's1', name: '声声' }],
      student: { _id: 's1', name: '声声' },
      studentId: 's1',
      ratings: { breath: 0, pronunciation: 0, rhythm: 0, emotion: 0, confidence: 0 },
      comment: '',
      audioFileId: '',
      audioFiles: [],
      audioUploading: false,
      submitting: false,
      dirty: false
    })
    await page.callMethod('saveCurrentFeedback')
    await expectToast(miniProgram, /至少完成一项评分/)
    await page.setData({ ratings: { breath: 4, pronunciation: 0, rhythm: 0, emotion: 0, confidence: 0 } })
    await page.callMethod('useTemplate', { currentTarget: { dataset: { type: 'encourage', dimension: 'rhythm' } } })
    const data = await page.data()
    if (!data.comment || /气息控制/.test(data.comment)) throw new Error(`template dimension not dynamic: ${data.comment}`)
    await screenshot(miniProgram, 'feedback')
  })

  await runScenario(miniProgram, 'payment validation', 'teacher', true, async (miniProgram) => {
    const page = await openPage(miniProgram, '/pages/teacher/payment/payment?studentId=s1')
    await page.setData({
      loading: false,
      isAdmin: true,
      studentId: 's1',
      students: [{ _id: 's1', name: '声声' }],
      packages: [{ _id: 'p1', name: '朱哥课程', unit_price: 200 }],
      selectedStudentIndex: 0,
      selectedPackageIndex: -1,
      courseCount: '',
      amount: '',
      payDate: '2026-06-17',
      payMethod: '微信',
      submitting: false
    })
    await page.callMethod('onSave')
    await expectToast(miniProgram, /请填写完整信息/)
    await screenshot(miniProgram, 'payment')
  })

  await runScenario(miniProgram, 'admin can switch to parent view', 'teacher', true, async (miniProgram) => {
    const page = await openPage(miniProgram, '/pages/teacher/profile/profile')
    await wait(800)
    await page.callMethod('onSwitchToParent')
    await wait(500)
    let data = await page.data()
    if (!data.showParentSwitchModal) throw new Error('parent switch modal not shown')
    await page.callMethod('onSelectParentStudent', { currentTarget: { dataset: { index: 0 } } })
    await expectPath(miniProgram, '/pages/parent/home/home')
    await screenshot(miniProgram, 'profile-parent-switch')
  })

  await runScenario(miniProgram, 'parent home leave button', 'parent', true, async (miniProgram) => {
    trace('parent open home')
    let page = await openPage(miniProgram, '/pages/parent/home/home')
    trace('parent payment toast')
    await page.callMethod('goPaymentList')
    await expectToast(miniProgram, /请联系老师/)
    trace('parent go leave')
    await page.callMethod('goLeave')
    await expectPath(miniProgram, '/pages/parent/leave/leave')
  })

  await runScenario(miniProgram, 'parent home records button', 'parent', true, async (miniProgram) => {
    trace('parent open home for records')
    let page = await openPage(miniProgram, '/pages/parent/home/home')
    trace('parent go records')
    await page.callMethod('goRecords')
    await expectPath(miniProgram, '/pages/parent/records/records')
  })

  await runScenario(miniProgram, 'parent records filter button', 'parent', true, async (miniProgram) => {
    trace('parent records filter')
    let page = await openPage(miniProgram, '/pages/parent/records/records')
    await page.callMethod('setFilter', { currentTarget: { dataset: { filter: 'thisMonth' } } })
    if ((await page.data()).filter !== 'thisMonth') throw new Error('records filter did not change')
    await screenshot(miniProgram, 'parent-records')
  })

  await runScenario(miniProgram, 'parent leave and profile actions', 'parent', true, async (miniProgram) => {
    let page = await openPage(miniProgram, '/pages/parent/leave/leave')
    await page.setData({ loading: false, studentId: 's1', selectedScheduleIndex: -1, schedules: [], submitting: false })
    await page.callMethod('onSubmit')
    await expectToast(miniProgram, /请选择请假的课程/)

    page = await openPage(miniProgram, '/pages/parent/profile/profile')
    await page.setData({ loading: false, student: { _id: 's1', name: '声声' }, switchedFromTeacher: true })
    await page.callMethod('onSwitchBackToTeacher')
    await expectPath(miniProgram, '/pages/teacher/home/home')
    await screenshot(miniProgram, 'parent-profile')
  })

  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2))
  const failed = results.filter(r => !r.ok)
  if (failed.length) throw new Error(`${failed.length} button regression checks failed`)
  } finally {
    await miniProgram.close().catch(() => {})
  }
}

main().catch(err => {
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2))
  console.error(err && (err.stack || err.message) || err)
  process.exit(1)
})
