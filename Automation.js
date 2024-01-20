const http = require("http");
const { RestClientV5 } = require("bybit-api");
const dotenv = require("dotenv");
dotenv.config();

const server = http.createServer(async function (request, response) {
  if (request.method == "POST") {
    // REQUEST INCOMING
    const isTestnet = process.env.TESTNET;
    let publicKey;
    let secretKey;

    isTestnet
      ? (publicKey = process.env.TESTNET_BYBIT_API_KEY)
      : (publicKey = process.env.BYBIT_API_KEY);
    isTestnet
      ? (secretKey = process.env.TESTNET_BYBIT_API_SECRET_KEY)
      : (publicKey = process.env.BYBIT_API_SECRET_KEY);

    // INITIATING CONNECTION
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
      console.log("body", bodyParsed);
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

      // VERIFY IF THERE IS ALREADY AN OPEN POSITION
      const responseGetPositionInfo = await client.getPositionInfo({
        category: "linear",
        symbol: coin,
      });

      const currentPositionSize = responseGetPositionInfo.result.list[0];

      if (bodyParsed.action === "TakeProfit") {
        console.log(
          "Reaching technical indicator, taking profit from the position"
        );

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
          console.log("Order closed successfully");
        }

        return;
      }

      if (
        currentPositionSize.side === bodyParsed.action &&
        currentPositionSize.size !== "0"
      ) {
        console.log(
          "Skipping order, already " +
            currentPositionSize.side +
            " order running."
        );
        return;
      }

      if (
        currentPositionSize.side !== bodyParsed.action &&
        currentPositionSize.size !== "0"
      ) {
        console.log(
          "Current " + currentPositionSize.side + " order running. Closing it."
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
        }
      }

      const finalQuantity =
        (bodyParsed.quantityUSDT / bodyParsed.coinPrice) * bodyParsed.leverage;

      const responseFinal = await client.submitOrder({
        category: "linear",
        symbol: coin,
        side: bodyParsed.action,
        qty: String(finalQuantity.toFixed(0)),
        orderType: "Market",
      });

      if (responseFinal.retMsg === "OK") {
        console.log(bodyParsed.action + " order open successfully !");
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
