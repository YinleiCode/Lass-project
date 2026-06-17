const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules') continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, files)
    else if (ent.name.endsWith('.js')) files.push(full)
  }
  return files
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertMatch(file, pattern, message) {
  const text = read(file)
  assert(pattern.test(text), `${file}: ${message}`)
}

const cloudRoot = path.join(root, 'cloudfunctions')
const offenders = []

for (const file of walk(cloudRoot)) {
  const text = fs.readFileSync(file, 'utf8')
  const rel = path.relative(root, file)
  text.split(/\n/).forEach((line, idx) => {
    if (/transaction\.collection\([^\n]+\)\.where/.test(line)) {
      offenders.push(`${rel}:${idx + 1}`)
    }
  })

  if (text.includes('function isAdminTeacher') || text.includes('function isAdminUser')) {
    assert(
      text.includes("['admin', 'super_admin', 'principal', 'owner'].includes(role)"),
      `${rel}: admin helper must recognize role-based admins`
    )
  }
}

assert(offenders.length === 0, `transaction where is not allowed:\n${offenders.join('\n')}`)

assertMatch(
  'cloudfunctions/cm_bindParent/index.js',
  /BIND_ATTEMPT_LIMIT\s*=\s*10/,
  'parent bind must have rate limit'
)
assertMatch(
  'cloudfunctions/cm_bindParent/index.js',
  /parent_bind_attempts/,
  'parent bind attempts must be recorded'
)
assertMatch(
  'cloudfunctions/cm_clearData/index.js',
  /parent_bind_attempts/,
  'clear data must clean parent bind attempts'
)
assertMatch(
  'cloudfunctions/cm_initDB/index.js',
  /parent_bind_attempts/,
  'init DB must create parent bind attempts collection'
)

console.log('cloud safety regression checks passed')
