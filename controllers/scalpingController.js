const { RestClientV5 } = require("bybit-api");
const dotenv = require("dotenv");
let mysql2 = require("mysql2/promise")
dotenv.config();
const { telegramService } = require('../services/telegramService')


const postScalping = (async (request, response) => {
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
    console.log("new scalping order");


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
    const {ticker, action, coinPrice, leverage, quantityUSDT, trendlineType, trendlineCoinPosition} = body
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
    
      // TAKE PROFIT INTO EXCHANGE
      if (action === "TakeProfit") {
        console.log("Taking profit from the position");

        const side = currentPositionSize.side === "Buy" ? "Sell" : "Buy";
        const responseTakeProfit = await client.submitOrder({
          category: "linear",
          symbol: coin,
          side: side,
          qty: "0",
          orderType: "Market",
          reduceOnly: "true",
        });

        if (responseTakeProfit.retMsg === "OK") {
          console.log("SUCCESS : Exchange order closed");

          const updateDb = await db.query(
            `UPDATE scalping_db SET trade_running = 0, trade_type = NULL, updated_at = NOW() WHERE token_name = '${coin}'`
          );

          console.log("SUCCESS :  Update token details in database ", updateDb);
        }
      }

      // SET TRENDLINE INTO DB
      if (action === "SetTrendline") {
        console.log("SetTrendline action to database");

        const [selectCoinFromDb] = await db.query(
          `SELECT * FROM scalping_db WHERE token_name='${coin}'`
        );

        if (!selectCoinFromDb[0]) {
          const insertDb = await db.query(
            `INSERT INTO scalping_db (token_name, trendline_type, trendline_coin_position, created_at, updated_at) VALUES ('${coin}', '${trendlineType}', '${trendlineCoinPosition}', NOW(), NOW())`
          );

          telegramPayload = `Create new token ${coin} in database : ${insertDb}`
          console.log(telegramPayload)
        }

        if (selectCoinFromDb[0]) {
          const updateDb = await db.query(
            `UPDATE scalping_db SET trendline_type = '${trendlineType}', trendline_coin_position = '${trendlineCoinPosition}', updated_at = NOW() WHERE token_name = '${coin}'`
          );

          console.log("SUCCESS : Update token in database", updateDb);
        }
      }

      // BUY OR SELL ORDER INTO EXCHANGE
      if (action === "Buy" || action === "Sell") {
        // SAME POSITION SIDE RUNNING, SKIPPING

        if (
          currentPositionSize.side === action &&
          currentPositionSize.size !== "0"
        ) {

          telegramPayload = `Skipping order, already ${currentPositionSize.side} order running.`
          console.log(telegramPayload)
        }

        // OPPOSITE POSITION SIDE RUNNING, CLOSING IT
        if (
          currentPositionSize.side !== action &&
          currentPositionSize.size !== "0"
        ) {
          telegramPayload = `currentPositionSize ${currentPositionSize.side} order running. Closing it.`
          console.log(telegramPayload)

          const responseClosePosition = await client.submitOrder({
            category: "linear",
            symbol: coin,
            side: action,
            qty: "0",
            orderType: "Market",
            reduceOnly: "true",
          });

          if (responseClosePosition.retMsg === "OK") {
            console.log("Order closed successfully");

            const updateDb = await db.query(
              `UPDATE scalping_db SET trade_running = 0, trade_type = NULL, updated_at = NOW() WHERE token_name = '${coin}'`
            );

            await db.end();
            console.log("success update token in db ", updateDb);
          }
        }

        // NEW BUY OR SELL ORDER, OPENING IT
        const [selectCoinFromDb] = await db.query(
          `SELECT * FROM scalping_db WHERE token_name='${coin}'`
        );

        if (selectCoinFromDb.length === 0) {
          telegramPayload = `Coin ${coin} does not exists on database, skipping ${action} order.`
          console.log(telegramPayload)
        }

        if (selectCoinFromDb.length !== 0) {
            telegramPayload = `Coin ${coin} exists on database, skipping ${action} order.`

          if (
            !selectCoinFromDb[0].trendline_type ||
            !selectCoinFromDb[0].trendline_coin_position
          ) {
            telegramPayload = `Coin ${coin}  does not have trendline data, skipping ${action} order.`
            console.log(telegramPayload);
          }

          const finalQuantity =
            (quantityUSDT / coinPrice) *
            leverage;

          const coinDb = selectCoinFromDb[0];

          // OPEN POSITION REGARDING TRENDLINE CONFIGURATION
          if (coinDb.trendline_type === "UPTREND") {
            if (coinDb.trendline_coin_position === "ABOVE") {
              const responseFinal = await client.submitOrder({
                category: "linear",
                symbol: coin,
                side: "Buy",
                qty: String(finalQuantity.toFixed(0)),
                orderType: "Market",
              });

              if (responseFinal.retMsg === "OK") {
                telegramPayload = `Coin ${coin} Buy order open successfully !`
                console.log(telegramPayload);

                await db.connect(connection);
                const updateDb = await db.query(
                  `UPDATE scalping_db SET trade_running = 1, trade_type = 'Buy' WHERE token_name = '${coin}'`
                );

                console.log("success update token in db ", updateDb);
              }
            }

            if (coinDb.trendline_coin_position === "BELOW") {
              telegramPayload = `Coin ${coin} skipping ${action} order, trendlines configurations does not match.`
              console.log(telegramPayload);

            }
          }

          if (coinDb.trendline_type === "DOWNTREND") {
            if (coinDb.trendline_coin_position === "ABOVE") {
              if (action === "Buy") {
                telegramPayload = `Coin ${coin} skipping ${action} order, trendlines configurations does not match.`
                console.log(telegramPayload);
              }

              if (action === "Sell") {
                const responseFinal = await client.submitOrder({
                  category: "linear",
                  symbol: coin,
                  side: "Buy",
                  qty: String(finalQuantity.toFixed(0)),
                  orderType: "Market",
                });

                if (responseFinal.retMsg === "OK") {
                    telegramPayload = `Coin ${coin} Buy order open successfully !`
                    console.log(telegramPayload);

                  const updateDb = await db.query(
                    `UPDATE scalping_db SET trade_running = 1, trade_type = 'Buy' WHERE token_name = '${coin}'`
                  );

                  console.log("success update token in db ", updateDb);
                }
              }
            }

            if (coinDb.trendline_coin_position === "BELOW") {
              if (action === "Buy") {
                telegramPayload = `Coin ${coin} skipping ${action} order, trendlines configurations does not match.`
                console.log(telegramPayload);
              }

              if (action === "Sell") {

                const responseFinal = await client.submitOrder({
                  category: "linear",
                  symbol: coin,
                  side: action,
                  qty: String(finalQuantity.toFixed(0)),
                  orderType: "Market",
                });

                if (responseFinal.retMsg === "OK") {
                  telegramPayload = `Coin ${coin} ${action} order open successfully !`
                  console.log(telegramPayload);

                  const updateDb = await db.query(
                    `UPDATE scalping_db SET trade_running = 1, trade_type = '${action}' WHERE token_name = '${coin}'`
                  );
                  console.log("success update token in db ", updateDb);
                }

                if (responseFinal.retMsg !== "OK") {
                  telegramPayload = `Coin ${coin} ${action} order error : ${responseFinal.retMsg}`
                  console.log(telegramPayload);
                }
              }
            }
          }
        }
      }

      await telegramService(isTestnet, 'scalpingController', 'success', telegramPayload)
      response.sendStatus(200)
    } catch(error) {
        await telegramService(isTestnet, 'scalpingController', 'error', error)
        
        response
        .status(500)
        console.log(`throw error ${error}`)
    }
    })
    
    module.exports = {
        postScalping
    }