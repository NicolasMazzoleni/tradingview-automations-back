
const dotenv = require("dotenv");
let mysql2 = require("mysql2/promise")
dotenv.config();
const { getTotalAccountBalance, postOrder, isOpenedOrder } = require('../services/kucoinService')
const { telegramService } = require('../services/telegramService')
const { getCoinMarketCap } = require('../services/coinMarketCapService');
const { post } = require("../routes/swingRoute");

const postSwing = (async (request, response) => {
    const isTestnet = process.env.TESTNET;
    let publicKey;
    let secretKey;
    
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
      const commonTelegramPayload = {isTestnet, source: 'swingController', type: 'success', action, coin }

      const totalAccountBalance = 300
      // const totalAccountBalance = await getTotalAccountBalance()
      const coinMarketCap = await getCoinMarketCap({coin: coin})
      let totalAmoutPerPosition
      let amountPosition

      // Market cap < 200M
      if (coinMarketCap < 200000000) {
          // equivaut à 1% du portefeuille
          totalAmoutPerPosition = totalAccountBalance*(1/100)
      }

      // Market cap > 200M
      if (coinMarketCap > 200000000) {
          // equivaut à 2% du portefeuille
          totalAmoutPerPosition = totalAccountBalance*(2/100)
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
        case 'double':
          amountPosition = totalAmoutPerPosition*(80/100)
        break;
        case 'resistance':
          amountPosition = totalAmoutPerPosition*(20/100)
        break;
    }

    const baseParams = {
        "clientOid": process.env.KUCOIN_UUID,
        "side": action === "Buy" ? "buy" : "sell",
        "symbol": `${coin}-USDT`,
        "type": "market",
        "tradeType": "TRADE",
        "funds": parseFloat(amountPosition.toFixed(2).toString().replace(',','.').replace(' ',''))
    }

    const [selectCoinFromDb] = await db.query(
        `SELECT * FROM swing_db WHERE token_name='${coin}'`
      );

      if (action === 'Buy') {
          if (!selectCoinFromDb[0]) {
            const insertDb = await db.query(
              `INSERT INTO swing_db (token_name, created_at, updated_at) VALUES ('${coin}', NOW(), NOW())`
            );
  
            await telegramService(commonTelegramPayload, `SUCCESS create token in database : ${JSON.stringify(insertDb)}`)
          }

        const resPostOrder = await postOrder(baseParams)

        if (resPostOrder.code === '200000') {
            await telegramService(commonTelegramPayload, `SUCCESS ${strategy} strategy order on exchange : ${resPostOrder.data.orderId}`)

            const updateDb = await db.query(
                `UPDATE swing_db SET trade_running = 1, buy_${strategy} = 1, buy_${strategy}_date = NOW(), updated_at = NOW() WHERE token_name = '${coin}'`
              );

              await telegramService(commonTelegramPayload, `SUCCESS update token in database : ${JSON.stringify(updateDb)}`)
        }

        if (resPostOrder.code !== '200000') {
            await telegramService(commonTelegramPayload, `ERROR ${strategy} strategy order on exchange : ${resPostOrder.msg}`)
        }
      }

      if (action === 'Sell') {
          if (!selectCoinFromDb[0]) {
            await telegramService(commonTelegramPayload, `ERROR ${strategy} strategy order : coin does not exists on db.`)
          }

          if (selectCoinFromDb[0]) {
            const resPostOrder = await postOrder(baseParams)

            if (resPostOrder.code === '200000') { 
                await telegramService(commonTelegramPayload, `SUCCESS ${strategy} strategy order on exchange : ${resPostOrder.data.orderId}`)
    
                const updateDb = await db.query(
                    `UPDATE swing_db SET sell_${strategy} = 1, sell_${strategy}_date = NOW(), updated_at = NOW() WHERE token_name = '${coin}'`
                  );
    
                  await telegramService(commonTelegramPayload, `SUCCESS update token in database : ${JSON.stringify(updateDb)}`)
            }
    
            if (resPostOrder.code !== '200000') {
                await telegramService(commonTelegramPayload, `ERROR ${strategy} strategy order on exchange : ${resPostOrder.msg}`)
            }
          }
      }

      if (action === 'TakeProfit') {
          if (!selectCoinFromDb[0]) {
            await telegramService(commonTelegramPayload, `ERROR ${strategy} strategy order : coin does not exists on db.`)
          }

          if (selectCoinFromDb[0]) {
            const resPostOrder = await postOrder(baseParams)
            console.log('here ', resPostOrder)

            if (resPostOrder.code === '200000') {
                await telegramService(commonTelegramPayload, `SUCCESS ${strategy} strategy order on exchange : ${resPostOrder.data.orderId}`)
    
                const updateDb = await db.query(
                    `UPDATE swing_db SET take_profit_${strategy} = 1, take_profit_${strategy}_date = NOW(), updated_at = NOW() WHERE token_name = '${coin}'`
                  );
    
                  await telegramService(commonTelegramPayload, `SUCCESS update token in database : ${JSON.stringify(updateDb)}`)
            }
    
            if (resPostOrder.code !== '200000') {
                await telegramService(commonTelegramPayload, `ERROR ${strategy} strategy order on exchange : ${resPostOrder.msg}`)
            }
          }
      }


      // CHECK IF THIS COIN STILL HAVE BALANCE ON EXCHANGE
      const isOpen = await isOpenedOrder(coin)
      if (!isOpen) {
        const updateDb = await db.query(
            `UPDATE swing_db SET trade_running = 0, updated_at = NOW() WHERE token_name = '${coin}'`
          );

          await telegramService(commonTelegramPayload, `SUCCESS update token in database : ${JSON.stringify(updateDb)}`)
      }

      await db.end();
      response.sendStatus(200)
    } catch (error) {
        const commonTelegramPayload = {isTestnet, source: 'swingController', type: 'error', action: '', coin: '' }
        await telegramService(commonTelegramPayload, error)
        
        response.sendStatus(500)
        console.log(`throw error ${error}`)
    }
    })

module.exports = {
    postSwing
}