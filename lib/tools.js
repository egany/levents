const fs = require("fs");
const path = require("path");
const { sort } = require("fast-sort");
const province = require("../../Rapid Province (rapid.province).json");
const district = require("../../Rapid District (rapid.district).json");
const ward = require("../../Rapid Ward (rapid.ward).json");

async function main() {
  const result = [];
  const sortedProvince = sort(province).asc((p) => p["GHN Province ID"]);

  for (const p of sortedProvince) {
    let _p = {
      code: p["GHN Province ID"],
      name: p["Name"],
      districts: [],
    };

    let _ds = sort(district.filter((_d) => _d.Province === _p.name)).asc(
      (_d) => _d["GHN District ID"]
    );

    for (const _d of _ds) {
      let _dop = {
        code: _d["GHN District ID"],
        name: _d["Name"],
        province_code: _p.code,
        wards: [],
      };

      let _ws = sort(ward.filter((_w) => _w["District"] === _dop.name)).asc(
        (_w) => _w["GHN Ward Code"]
      );

      for (const _s of _ws) {
        _dop.wards.push({
          code: _s["GHN Ward Code"],
          name: _s["Name"],
          province_code: _p.code,
          district_code: _dop.code,
        });
      }

      _p.districts.push(_dop);
    }

    result.push(_p);
  }

  fs.writeFile(
    path.join(path.join("."), "/lib/provinces.json"),
    JSON.stringify(result),
    (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log("Completed");
      }
    }
  );
}

main();
