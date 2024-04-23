const axios = require('axios');


const getCoinMarketCap = async ({coin, currency = 'EUR'}) => {
    
      const coinGlobalData = await axios.get(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${coin}&CMC_PRO_API_KEY=${process.env.COINMARKETCAP_API_KEY}&convert=${currency}`);
      const coinData = coinGlobalData.data.data
      return coinData[coin][0].quote[currency].market_cap
  };
  
  module.exports = {
    getCoinMarketCap
  }

