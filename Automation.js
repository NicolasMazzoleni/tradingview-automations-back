const http = require("http");
const { RestClientV5 } = require("bybit-api");
const dotenv = require("dotenv");
let mysql = require("mysql");
const { makeDb } = require("mysql-async-simple");
dotenv.config();

const server = http.createServer(async function (request, response) {
  if (request.method == "POST") {
    // REQUEST INCOMING
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
    const connection = mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DB_NAME,
    });
    const db = makeDb();
    await db.connect(connection);

    // INITIATING BYBIT CONNECTION
    console.log("initiating Bybit connection...");
    const client = await new RestClientV5({
      testnet: isTestnet ? true : false,
      key: publicKey,
      secret: secretKey,
    });

    var body = "";
    request.on("data", async function (data) {
      body += data;
      const bodyParsed = JSON.parse(body);
      console.log("bodyParsed", bodyParsed);
      const coin = bodyParsed.ticker.replace(".P", "");

      await client.setLeverage({
        category: "linear",
        symbol: coin,
        buyLeverage: bodyParsed.leverage,
        sellLeverage: bodyParsed.leverage,
      });

      if (bodyParsed.action === "Buy") {
        console.log("Buy order incoming...");
      }
      if (bodyParsed.action === "Sell") {
        console.log("Sell order incoming...");
      }
      if (bodyParsed.action === "TakeProfit") {
        console.log("TakeProfit order incoming...");
      }
      if (bodyParsed.action === "SetTrendline") {
        console.log("SetTrendline order incoming...");
      }

      // CHECK IF THERE IS ALREADY AN OPEN POSITION
      const responseGetPositionInfo = await client.getPositionInfo({
        category: "linear",
        symbol: coin,
      });

      const currentPositionSize = responseGetPositionInfo.result.list[0];

      // TAKE PROFIT INTO EXCHANGE
      if (bodyParsed.action === "TakeProfit") {
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
            connection,
            `UPDATE automation SET trade_running = 0, trade_type = NULL, updated_at = NOW() WHERE token_name = '${coin}'`
          );

          console.log("SUCCESS :  Update token details in database ", updateDb);
        }

        await db.close(connection);
        return;
      }

      // SET TRENDLINE INTO DB
      if (bodyParsed.action === "SetTrendline") {
        console.log("SetTrendline action to database");

        const selectCoinFromDb = await db.query(
          connection,
          `SELECT * FROM automation WHERE token_name='${coin}'`
        );

        if (!selectCoinFromDb[0]) {
          const insertDb = await db.query(
            connection,
            `INSERT INTO automation (token_name, trendline_type, trendline_coin_position, created_at, updated_at) VALUES ('${coin}', '${bodyParsed.trendlineType}', '${bodyParsed.trendlineCoinPosition}', NOW(), NOW())`
          );

          console.log("SUCCESS : Create new token in database", insertDb);
          await db.close(connection);
          return;
        }

        if (selectCoinFromDb[0]) {
          const updateDb = await db.query(
            connection,
            `UPDATE automation SET trendline_type = '${bodyParsed.trendlineType}', trendline_coin_position = '${bodyParsed.trendlineCoinPosition}', updated_at = NOW() WHERE token_name = '${coin}'`
          );

          console.log("SUCCESS : Update token in database", updateDb);
          await db.close(connection);
          return;
        }
      }

      // BUY OR SELL ORDER INTO EXCHANGE
      if (bodyParsed.action === "Buy" || bodyParsed.action === "Sell") {
        // SAME POSITION SIDE RUNNING, SKIPPING
        if (
          currentPositionSize.side === bodyParsed.action &&
          currentPositionSize.size !== "0"
        ) {
          console.log(
            "Skipping order, already " +
              currentPositionSize.side +
              " order running."
          );
          await db.close(connection);
          return;
        }

        // OPPOSITE POSITION SIDE RUNNING, CLOSING IT
        if (
          currentPositionSize.side !== bodyParsed.action &&
          currentPositionSize.size !== "0"
        ) {
          console.log(
            "Current " +
              currentPositionSize.side +
              " order running. Closing it."
          );

          const responseClosePosition = await client.submitOrder({
            category: "linear",
            symbol: coin,
            side: bodyParsed.action,
            qty: "0",
            orderType: "Market",
            reduceOnly: "true",
          });

          if (responseClosePosition.retMsg === "OK") {
            console.log("Order closed successfully");

            const updateDb = await db.query(
              connection,
              `UPDATE automation SET trade_running = 0, trade_type = NULL, updated_at = NOW() WHERE token_name = '${coin}'`
            );

            await db.close(connection);
            console.log("success update token in db ", updateDb);
          }
        }

        // NEW BUY OR SELL ORDER, OPENING IT
        const selectCoinFromDb = await db.query(
          connection,
          `SELECT * FROM automation WHERE token_name='${coin}'`
        );

        if (selectCoinFromDb.length === 0) {
          console.log(
            "Coin does not exists on database, skipping " +
              bodyParsed.action +
              " order."
          );

          await db.close(connection);
          return;
        }

        if (selectCoinFromDb.length !== 0) {
          console.log("Coin exists on database ", selectCoinFromDb[0]);

          if (
            !selectCoinFromDb[0].trendline_type ||
            !selectCoinFromDb[0].trendline_coin_position
          ) {
            console.log(
              "Coin does not have trendline data, skipping " +
                bodyParsed.action +
                " order."
            );

            await db.close(connection);
            return;
          }

          const finalQuantity =
            (bodyParsed.quantityUSDT / bodyParsed.coinPrice) *
            bodyParsed.leverage;

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
                console.log("Buy order open successfully !");

                const updateDb = await db.query(
                  connection,
                  `UPDATE automation SET trade_running = 1, trade_type = 'Buy' WHERE token_name = '${coin}'`
                );

                await db.close(connection);
                console.log("success update token in db ", updateDb);
              }

              await db.close(connection);
              return;
            }

            if (coinDb.trendline_coin_position === "BELOW") {
              console.log(
                "Skipping " +
                  bodyParsed.action +
                  " order, trendlines configurations does not match."
              );

              await db.close(connection);
              return;
            }
          }

          if (coinDb.trendline_type === "DOWNTREND") {
            if (coinDb.trendline_coin_position === "ABOVE") {
              if (bodyParsed.action === "Buy") {
                console.log(
                  "Skipping " +
                    bodyParsed.action +
                    " order, trendlines configurations does not match."
                );

                await db.close(connection);
                return;
              }

              if (bodyParsed.action === "Sell") {
                const responseFinal = await client.submitOrder({
                  category: "linear",
                  symbol: coin,
                  side: "Buy",
                  qty: String(finalQuantity.toFixed(0)),
                  orderType: "Market",
                });

                if (responseFinal.retMsg === "OK") {
                  console.log("Buy order open successfully !");

                  const updateDb = await db.query(
                    connection,
                    `UPDATE automation SET trade_running = 1, trade_type = 'Buy' WHERE token_name = '${coin}'`
                  );

                  await db.close(connection);
                  console.log("success update token in db ", updateDb);
                }

                await db.close(connection);
                return;
              }
            }

            if (coinDb.trendline_coin_position === "BELOW") {
              if (bodyParsed.action === "Buy") {
                console.log(
                  "Skipping " +
                    bodyParsed.action +
                    " order, trendlines configurations does not match."
                );

                await db.close(connection);
                return;
              }

              if (bodyParsed.action === "Sell") {
                const responseFinal = await client.submitOrder({
                  category: "linear",
                  symbol: coin,
                  side: bodyParsed.action,
                  qty: String(finalQuantity.toFixed(0)),
                  orderType: "Market",
                });

                if (responseFinal.retMsg === "OK") {
                  console.log(bodyParsed.action + " order open successfully !");

                  const updateDb = await db.query(
                    connection,
                    `UPDATE automation SET trade_running = 1, trade_type = '${bodyParsed.action}' WHERE token_name = '${coin}'`
                  );

                  await db.close(connection);
                  console.log("success update token in db ", updateDb);
                }

                await db.close(connection);
                return;
              }
            }
          }
        }
      }
    });
    request.on("end", function () {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("order triggered received");
    });
  } else {
    console.log("error");
  }
});

const port = 3000;
const host = "127.0.0.1";
server.listen(port, host);
console.log(`Listening at http://${host}:${port}`);
