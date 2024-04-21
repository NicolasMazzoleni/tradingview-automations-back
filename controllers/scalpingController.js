const { RestClientV5 } = require("bybit-api");
const dotenv = require("dotenv");
let mysql2 = require("mysql2/promise")
dotenv.config();


// exanmple : https://dev.to/ericlecodeur/nodejs-express-partie-5-routes-et-controllers-18l
const postScalping = (async (request, response) => {

    console.log("---------------------");
    console.log("new scalping order");

    const isTestnet = process.env.TESTNET;
    let publicKey;
    let secretKey;
    
    isTestnet
        ? (publicKey = process.env.TESTNET1_BYBIT_API_KEY)
        : (publicKey = process.env.BYBIT_API_KEY);
    isTestnet
        ? (secretKey = process.env.TESTNET1_BYBIT_API_SECRET_KEY)
        : (publicKey = process.env.BYBIT_API_SECRET_KEY);


    // INITIATING MYSQL CONNECTION
    console.log("initiating MariaDB connection...");
    const db = await mysql2.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB_NAME,
      });
     
      await db.connect();
  
      // INITIATING BYBIT CONNECTION
      console.log("initiating Bybit connection...");
      const client = await new RestClientV5({
        testnet: isTestnet ? true : false,
        key: publicKey,
        secret: secretKey,
      });

    const body = request.body
    const {ticker, action, coinPrice, leverage, quantityUSDT, trendlineTyp, trendlineCoinPositione} = body
    const coin = ticker.replace(".P", "");
    
    await client.setLeverage({
        category: "linear",
        symbol: coin,
        buyLeverage: leverage,
        sellLeverage: leverage,
      });

      if (action === "Buy") {
        console.log("Buy order incoming...");
      }
      if (action === "Sell") {
        console.log("Sell order incoming...");
      }
      if (action === "TakeProfit") {
        console.log("TakeProfit order incoming...");
      }
      if (action === "SetTrendline") {
        console.log("SetTrendline order incoming...");
      }

            // CHECK IF THERE IS ALREADY AN OPEN POSITION
      const responseGetPositionInfo = await client.getPositionInfo({
        category: "linear",
        symbol: coin,
      });

      const currentPositionSize = responseGetPositionInfo.result.list[0]

      //TODO

    })
    
    module.exports = {
        postScalping
    }