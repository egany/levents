const express = require("express");
const router = express.Router();
const { Location } = require("../model/location");

router.get("/provinces", async (req, res, next) => {
  try {
    const params = req.query;
    params.onlyName = params.onlyName === "true" ? true : false;
    params.onlyProvince = params.onlyProvince === "true" ? true : false;
    params.onlyDistrict = params.onlyDistrict === "true" ? true : false;

    let result = {
      data: {},
      errors: [],
    };

    if (params.onlyName === true) {
      result.data = (
        await Location.find({}).select({ name: 1, _id: 0 }).lean()
      ).map((l) => l.name);
      return res.json(result);
    }

    if (params.onlyProvince === true) {
      result.data = await Location.find()
        .select({ name: 1, code: 1, _id: 0 })
        .lean();
      return res.json(result);
    }

    let filter = {};

    if (params.code) {
      params.code = Number.parseInt(params.code);
      filter.code = params.code;
    } else if (params.name) {
      filter.name = params.name;
    }

    const province = await Location.findOne(filter, { _id: 0 }).lean();

    if (params.districtCode) {
      params.districtCode = Number.parseInt(params.districtCode);
      province.districts = province.districts.filter(
        (d) => d.code === params.districtCode
      );
    } else if (params.districtName) {
      province.districts = province.districts.filter(
        (d) => d.name === params.name
      );
    }

    if (params.onlyDistrict) {
      province.districts = province.districts.map((d) => {
        let _d = { ...d };
        delete _d.wards;
        return _d;
      });
    }

    result.data = province;
    res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
