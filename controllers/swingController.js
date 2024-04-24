
const dotenv = require("dotenv");
let mysql2 = require("mysql2/promise")
dotenv.config();
const { getTotalAccountBalance, postOrder } = require('../services/kucoinService')
const { telegramService } = require('../services/telegramService')
const { getCoinMarketCap } = require('../services/coinMarketCapService');
const { post } = require("../routes/swingRoute");

const postSwing = (async (request, response) => {
    const isTestnet = process.env.TESTNET;
    let publicKey;
    let secretKey;
    let telegramPayload;
    
    isTestnet
        ? (publicKey = process.env.TESTNET1_BYBIT_API_KEY)
        : (publicKey = process.env.BYBIT_API_KEY);
    isTestnet
        ? (secretKey = process.env.TESTNET1_BYBIT_API_SECRET_KEY)
        : (publicKey = process.env.BYBIT_API_SECRET_KEY);

    try {
    console.log("---------------------");
    console.log("new swing order");


    // INITIATING MYSQL CONNECTION
    console.log("initiating MariaDB connection...");
    const db = await mysql2.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB_NAME,
      });
      
      await db.connect();

      const body = request.body
      const {ticker, action, strategy, coinPrice} = body
      const coin = ticker.replace("USDT", "");

      if (action === 'Buy') {
        const getTotalAccountBalance = 300
        // const totalAccountBalance = await getTotalAccountBalance()
        const coinMarketCap = await getCoinMarketCap({coin: coin})
        let totalAmoutPerPosition
        let amountPosition

        // Market cap < 200M
        if (coinMarketCap < 200000000) {
            // equivaut à 1% du portefeuille
            totalAmoutPerPosition = getTotalAccountBalance*(1/100)
        }

        // Market cap > 200M
        if (coinMarketCap > 200000000) {
            // equivaut à 2% du portefeuille
            totalAmoutPerPosition = getTotalAccountBalance*(2/100)
        }

        switch (strategy) {
            case 'robo':
                amountPosition = totalAmoutPerPosition*(50/100)
            break;
            case 'breakout':
                amountPosition = totalAmoutPerPosition*(30/100)
            break;
            case 'support':
                amountPosition = totalAmoutPerPosition*(20/100)
            break;
        }

        const baseParams = {
            "clientOid": process.env.KUCOIN_UUID,
            "side": "buy",
            "symbol": `${coin}-USDT`,
            "type": "market",
            "tradeType": "TRADE",
            "funds": '0.1'
        }

        const resPostOrder = await postOrder(baseParams)
        console.log('res ', resPostOrder)

        if (resPostOrder.code === '200000') {
            telegramPayload = `Coin ${coin} / ${action} / ${strategy} order success : ${resPostOrder.data.orderId}`
            console.log(telegramPayload);
        }

        if (resPostOrder.code !== '200000') {
            telegramPayload = `Coin ${coin} / ${action} / ${strategy} order error : ${resPostOrder.msg}`    
            console.log(telegramPayload);
        }
      }

      if (action === 'Sell') {}

      if (action === 'TakeProfit') {}




      //TODO 


      console.log('here')
      await telegramService(isTestnet, 'swingController', 'success', telegramPayload)
      response.sendStatus(200)
    } catch (error) {

    }
    })

module.exports = {
    postSwing
}