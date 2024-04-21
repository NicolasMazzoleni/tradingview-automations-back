const axios = require('axios');

const telegramService = async (isTestnet, source, type, payload) => {
    const data = { testnet: isTestnet, source, payload: payload }
    let formatText
    type === 'error' ? formatText = `❌ ERROR ${JSON.stringify(data)}` : formatText = `✅ SUCCESS ${JSON.stringify(data)}`
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage?chat_id=${process.env.TELEGRAM_USER_ID}&text=${formatText}`);
  };
  
  module.exports = {
    telegramService
  }

