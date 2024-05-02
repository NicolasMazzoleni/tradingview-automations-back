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

  const postOrder = async (baseParams = {}, orderParams = {}) => {
    const openSpotPosition = await API.rest.Trade.Orders.postOrder(baseParams, orderParams);
    return openSpotPosition
  }

  const isOpenedOrder = async (coin) => {
    const openedPositions = await API.rest.User.Account.getAccountsList({ type: 'trade' }) ;
    let isOpen = false
    
    for (const currencyObject of openedPositions.data) {  
      if (currencyObject.currency === coin && currencyObject.balance !== '0') {
          isOpen = true
      }
    }

    return isOpen
  }
  
  module.exports = {
    getTotalAccountBalance,
    postOrder,
    isOpenedOrder
  }

