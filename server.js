const express = require('express')
const app = express()
const swing_routes = require('./routes/swingRoute.js')
const scalp_routes = require('./routes/scalpingRoute.js')
// const cron = require('node-cron')
// const cronTVA = require('./cron/TradingviewAlertsDate.js')

app.listen(3000, () => {
    console.log('server is listening on port 3000')
})

app.use(express.json())
app.use('/swing', swing_routes)
app.use('/scalp', scalp_routes)

// new cron.schedule("*/15 * * * * *", () => {
//     cronTVA.index();
// });