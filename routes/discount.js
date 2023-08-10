const express = require("express");
const router = express.Router();
const { shopify } = require("../lib");
const { errors } = require("../core");

router.get("/", async (req, res, next) => {
  try {
    const result = await shopify.readManyBasicDiscountCodes(req.query);

    if (result.errors.length > 0) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      meta: {},
      errors: [errors.createError({})],
    });
  }
});

module.exports = router;
