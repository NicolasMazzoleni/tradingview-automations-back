
const dotenv = require("dotenv");
let mysql2 = require("mysql2/promise")
dotenv.config();
const { getTotalAccountBalance } = require('../services/kucoinService')
const { telegramService } = require('../services/telegramService')
const { getCoinMarketCap } = require('../services/coinMarketCapService')

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
      const {ticker, action, strategy} = body

      const coin = ticker.replace("USDT", "");
      const coinMarketCap = await getCoinMarketCap({coin: coin})
      console.log('coinData ', coinMarketCap)

      //TODO 


      

    } catch (error) {

    }
    })

module.exports = {
    postSwing
}