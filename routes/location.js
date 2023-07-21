const express = require("express");
const router = express.Router();
const { createError, ERR_NOT_FOUND } = require("../core").errors;
const _provinces = require("../lib/provinces.json");

router.get("/provinces", async (req, res) => {
  const params = req.query;
  params.onlyName = params.onlyName === "true" ? true : false;

  if (params.name) {
    const province = _provinces.find((p) => p.name === params.name);

    if (!province) {
      res.status(404).json({
        data: null,
        errors: [
          createError({
            code: 404,
            type: ERR_NOT_FOUND,
            message: "Not found",
            viMessage: "Không tìm thấy thông tin",
          }),
        ],
      });
      return;
    }

    res.json({
      data: province,
      errors: [],
    });
    return;
  }

  if (params.onlyName === true) {
    res.json({
      data: _provinces.map((p) => p.name),
      errors: [],
    });
    return;
  }

  res.json({
    data: _provinces,
    errors: [],
  });
});

module.exports = router;
