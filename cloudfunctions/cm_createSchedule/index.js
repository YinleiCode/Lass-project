// 创建排课（单次或周期性）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { type, studentIds, packageId, startTime, endTime, classroom, recurringRule, recurringEnd } = event

  if (!studentIds || !studentIds.length || !packageId || !startTime) {
    return { success: false, message: '参数不完整' }
  }

  try {
    if (type === 'once') {
      // 单次排课
      await db.collection('schedules').add({
        data: {
          student_ids: studentIds,
          package_id: packageId,
          start_time: startTime,
          end_time: endTime || '',
          classroom: classroom || '',
          status: 'pending',
          is_recurring: false,
          recurring_id: '',
          reminder_sent: false,
          created_at: db.serverDate()
        }
      })
      return { success: true, message: '排课成功', count: 1 }
    }

    if (type === 'recurring') {
      // 周期性排课：从startTime到recurringEnd，每周同一时间
      const recurringId = 'rec_' + Date.now()
      const start = new Date(startTime)
      const end = new Date(recurringEnd || startTime)
      // 最多生成52周
      end.setFullYear(end.getFullYear() + 1)

      let count = 0
      let current = new Date(start)

      while (current <= end && count < 52) {
        const startStr = current.toISOString().replace('T', ' ').substring(0, 16)
        
        // 计算结束时间
        let endStr = ''
        if (endTime) {
          const duration = new Date(endTime) - new Date(startTime)
          const endDate = new Date(current.getTime() + duration)
          endStr = endDate.toISOString().replace('T', ' ').substring(0, 16)
        }

        await db.collection('schedules').add({
          data: {
            student_ids: studentIds,
            package_id: packageId,
            start_time: startStr,
            end_time: endStr,
            classroom: classroom || '',
            status: 'pending',
            is_recurring: true,
            recurring_id: recurringId,
            reminder_sent: false,
            created_at: db.serverDate()
          }
        })

        // 加7天
        current.setDate(current.getDate() + 7)
        count++
      }

      return { success: true, message: `已生成${count}节周期课`, count: count }
    }

    return { success: false, message: '未知排课类型' }
  } catch (err) {
    console.error('排课失败', err)
    return { success: false, message: '排课失败: ' + err.message }
  }
}
