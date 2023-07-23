const express = require("express");
const router = express.Router();
const {
  createProxyMiddleware,
  fixRequestBody,
} = require("http-proxy-middleware");

router.post(
  "/api/v1/reviews",
  createProxyMiddleware({
    target: process.appSettings.judgeMeUrl,
    changeOrigin: true,
    pathRewrite: function (path, req) {
      return path.replace("/judge-me", "");
    },
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.appSettings.judgeMePrivateToken}`,
    },
    secure: false,
    onProxyReq: fixRequestBody,
  })
);

router.get(
  "/api/v1/reviews",
  createProxyMiddleware({
    target: process.appSettings.judgeMeUrl,
    changeOrigin: true,
    pathRewrite: function (path, req) {
      let newPath = path.replace("/judge-me", "");
      newPath = updateQueryStringParameter(
        newPath,
        "api_token",
        process.appSettings.judgeMePrivateToken
      );
      return newPath;
    },
    headers: {
      "Content-Type": "application/json",
    },
    secure: false,
    onProxyReq: fixRequestBody,
  })
);

function updateQueryStringParameter(path, key, value) {
  const re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  const separator = path.indexOf("?") !== -1 ? "&" : "?";
  if (path.match(re)) {
    return path.replace(re, "$1" + key + "=" + value + "$2");
  } else {
    return path + separator + key + "=" + value;
  }
}

module.exports = router;
