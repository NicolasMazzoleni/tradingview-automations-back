const axios = require('axios');

const telegramService = async (common, payload) => {
    const data = { testnet: common.isTestnet, source: common.source, action: common.action, coin: common.coin, payload: payload }
    let formatText
    common.type === 'error' ? formatText = `❌ ERROR ${JSON.stringify(data)}` : formatText = `✅ SUCCESS ${JSON.stringify(data)}`
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage?chat_id=${process.env.TELEGRAM_USER_ID}&text=${formatText}`);
  };
  
  module.exports = {
    telegramService
  }

