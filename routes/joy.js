const express = require("express");
const router = express.Router();
const {
  createProxyMiddleware,
  fixRequestBody,
} = require("http-proxy-middleware");

router.get(
  "/integrate/customer/rewards/:id",
  createProxyMiddleware({
    target: "https://joy.avada.io",
    changeOrigin: true,
    pathRewrite: function (path, req) {
      return path.replace("/joy-avada-io", "");
    },
    headers: {
      "Content-Type": "application/json",
      "X-Joy-Loyalty-App-Key": `${process.appSettings.joyAppKey}`,
      "X-Joy-Loyalty-Secret-Key": `${process.appSettings.joySecretKey}`
    },
    secure: false,
    onProxyReq: fixRequestBody,
  })
);

module.exports = router;
