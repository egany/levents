const express = require("express");
const router = express.Router();
const {
  createProxyMiddleware,
  fixRequestBody,
} = require("http-proxy-middleware");

router.post(
  "/api/v2/authentication/oauth2/token",
  createProxyMiddleware({
    target: process.appSettings.odooApiUrl,
    changeOrigin: true,
    pathRewrite: function (path, req) {
      return path.replace("/odoo", "");
    },
    headers: {
      Authorization: `Basic ${Buffer.from(
        process.appSettings.odooClientKey +
          ":" +
          process.appSettings.odooClientSecret
      ).toString("base64")}`,
    },
    secure: false,
    onProxyReq: fixRequestBody,
  })
);

module.exports = router;
