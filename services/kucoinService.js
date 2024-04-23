const API = require('kucoin-node-sdk');
API.init(require('../kucoinConfig.tpl'));

const getTotalAccountBalance = async () => {
  const openedPositions = await API.rest.User.Account.getAccountsList({ type: 'trade' }) ;
  let totalBalanceOfTradeAccount = 0

  for (const currencyObject of openedPositions.data) {  
    if (currencyObject.balance !== '0') {
        const getFiatPrice = await API.rest.Market.Currencies.getFiatPrice({ currencies: currencyObject.currency, base: 'EUR' }) ;
        const currencyFiatPrice = getFiatPrice.data[Object.keys(getFiatPrice.data)]

        const currencyFiatBalance = currencyFiatPrice*currencyObject.balance
        totalBalanceOfTradeAccount = totalBalanceOfTradeAccount + currencyFiatBalance
    }
  }

  return totalBalanceOfTradeAccount
  };
  
  module.exports = {
    getTotalAccountBalance
  }

