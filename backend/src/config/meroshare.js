// src/config/meroshare.js
module.exports = {
  AUTH_URL:     "https://webbackend.cdsc.com.np/api/meroShare",
  VIEW_URL:     "https://webbackend.cdsc.com.np/api/meroShareView",
  PURCHASE_URL: "https://webbackend.cdsc.com.np/api/myPurchase",
  EDIS_URL:     "https://webbackend.cdsc.com.np/api/EDIS",
  HOLDINGS_URL: "https://webbackend.cdsc.com.np/api/myHoldings",

  CREDENTIALS: {
    clientId: Number(process.env.MEROSHARE_CLIENT_ID),
    username: process.env.MEROSHARE_USERNAME,
    password: process.env.MEROSHARE_PASSWORD,
  },

  DEFAULTS: {
    PAGE: 1,
    SIZE: 200,
  },
};