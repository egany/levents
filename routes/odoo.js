const express = require("express");
const axios = require("axios").default;
const router = express.Router();
const {
  createProxyMiddleware,
  fixRequestBody,
} = require("http-proxy-middleware");

// router.post(
//   "/api/v2/authentication/oauth2/token",
//   createProxyMiddleware({
//     target: process.appSettings.odooApiUrl,
//     changeOrigin: true,
//     pathRewrite: function (path, req) {
//       return path.replace("/odoo", "");
//     },
//     headers: {
//       Authorization: `Basic ${Buffer.from(
//         process.appSettings.odooClientKey +
//           ":" +
//           process.appSettings.odooClientSecret
//       ).toString("base64")}`,
//     },
//     secure: false,
//     onProxyReq: fixRequestBody,
//   })
// );

router.post(
  "/api/v2/call/loyalty.card/redeem_voucher",
  async (req, res, next) => {
    try {
      const { data } = await axios({
        method: "POST",
        url: `${process.appSettings.odooApiUrl}/api/v2/authentication/oauth2/token`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            process.appSettings.odooClientKey +
              ":" +
              process.appSettings.odooClientSecret
          ).toString("base64")}`,
        },
        data: "grant_type=client_credentials",
      });

      req.headers.authorization = `Bearer ${data.access_token}`;
      next();
    } catch (error) {
      return next(error);
    }
  },
  createProxyMiddleware({
    target: process.appSettings.odooApiUrl,
    changeOrigin: true,
    pathRewrite: function (path, req) {
      return path.replace("/odoo", "");
    },
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    secure: false,
    onProxyReq: fixRequestBody,
  })
);

module.exports = router;
