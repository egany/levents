const express = require("express");
const router = express.Router();
const axios = require("axios").default;
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
  async (req, res, next) => {
    const external_id = req.query.product_id;
    const shop_domain = req.query.shop_domain;

    try {
      const { data } = await axios({
        method: "GET",
        url: `${process.appSettings.judgeMeUrl}/api/v1/products/-1?shop_domain=${shop_domain}&api_token=${process.appSettings.judgeMePrivateToken}&external_id=${external_id}`,
        headers: {
          "Content-Type": "application/json",
        },
      });
      req.query.product_id = data.product.id;
      return next();
    } catch (error) {
      return next(error);
    }
  },
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
      newPath = updateQueryStringParameter(
        newPath,
        "product_id",
        req.query.product_id
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
