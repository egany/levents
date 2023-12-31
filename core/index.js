module.exports = {
  errors: require("./errors"),
  helper: require("./helper"),
  ...require("./send-email-otp"),
  ...require("./send-smd-otp"),
  ...require("./generate-otp"),
  ...require("./verify-otp"),
  ...require("./response-codes"),
};
