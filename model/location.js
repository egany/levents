const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  code: Number,
  name: String,
  zip_code: String,
  districts: [
    {
      code: Number,
      name: String,
      province_code: Number,
      wards: [
        {
          code: String,
          name: String,
          province_code: Number,
          district_code: Number,
        },
      ],
    },
  ],
});

const Location = mongoose.model("Location", locationSchema);

module.exports = {
  Location,
};
