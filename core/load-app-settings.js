const helper = require("./helper");

const {
  BRAND,
  PORT,

  LOGLEVEL,

  SHOPIFY_HOSTNAME,
  SHOPIFY_ACCESS_TOKEN,
  SHOPIFY_CLIENT_KEY,
  SHOPIFY_CLIENT_SECRET,

  SENDGRID_API_KEY,
  SENDGRID_MAILER,

  VMG_BRANDNAME,
  VMG_BRANDSMS_API_URL,
  VMG_BRANDSMS_TOKEN,

  OTP_TEST_MODE,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_CREATE_ATTEMPTS,
  OTP_BLOCKED_HOUR,
  OTP_EXPIRES,

  MONGO_CONNECTION_STRING,
} = process.env;

process.appSettings = {
  brand: BRAND,
  post: helper.normalizePort(PORT || "3000"),

  logLevel: LOGLEVEL || "info",

  shopifyHostname: SHOPIFY_HOSTNAME,
  shopifyAccessToken: SHOPIFY_ACCESS_TOKEN,
  shopifyClientKey: SHOPIFY_CLIENT_KEY,
  shopifyClientSecret: SHOPIFY_CLIENT_SECRET,

  sendgridApiKey: SENDGRID_API_KEY,
  sendgridMailer: SENDGRID_MAILER,

  vmgBrandname: VMG_BRANDNAME,
  vmgBrandsmsApiUrl: VMG_BRANDSMS_API_URL,
  vmgBrandsmsToken: VMG_BRANDSMS_TOKEN,

  otpTestMode: OTP_TEST_MODE ? Number.parseInt(OTP_TEST_MODE) : 0,
  otpMaxAttempts: OTP_MAX_ATTEMPTS ? Number.parseInt(OTP_MAX_ATTEMPTS) : 5,
  otpMaxCreateAttempts: OTP_MAX_CREATE_ATTEMPTS
    ? Number.parseInt(OTP_MAX_CREATE_ATTEMPTS)
    : 3,
  otpBlockedHour: OTP_BLOCKED_HOUR ? Number.parseInt(OTP_BLOCKED_HOUR) : 12,
  otpExpires: OTP_EXPIRES ? Number.parseInt(OTP_EXPIRES) : 5,

  mongoConnectionString: MONGO_CONNECTION_STRING,
};
