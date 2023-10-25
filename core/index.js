module.exports = {
  errors: require("./errors"),
  helper: require("./helper"),
  ...require("./send-email-otp"),
  ...require("./send-sms-otp"),
  ...require("./send-sms-forgot-email"),
  ...require("./generate-otp"),
  ...require("./verify-otp"),
  ...require("./response-codes"),
};
