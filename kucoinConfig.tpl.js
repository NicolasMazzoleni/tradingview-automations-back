module.exports = {
    baseUrl: 'https://openapi-v2.kucoin.com',
    apiAuth: {
      key: process.env.KUCOIN_API_KEY,
      secret: process.env.KUCOIN_API_SECRET_KEY,
      passphrase: process.env.KUCOIN_API_PASSPHRASE,
    },
    authVersion: 2, // KC-API-KEY-VERSION. Notice: for v2 API-KEY, not required for v1 version.
  };