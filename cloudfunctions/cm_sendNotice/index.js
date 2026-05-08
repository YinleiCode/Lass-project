// 发送订阅消息
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { toUser, templateId, data, page } = event

  if (!toUser || !templateId || !data) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: toUser,
      templateId: templateId,
      page: page || '',
      data: data
    })

    return { success: true, result: result }
  } catch (err) {
    console.error('发送消息失败', err)
    return { success: false, message: err.message }
  }
}
