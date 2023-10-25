const axios = require("axios").default;
/**
 *
 * @param {Levents.SendPhoneOTPParams} params
 * @returns {Promise<Levents.SendPhoneOTPResult>}
 */
async function sendPhoneOTP(params) {
  if (process.env.SMS_PROVIDER === "VMG") {
    await sendPhoneOTPWithVMG(params);
  } else if (process.env.SMS_PROVIDER === "Vihat") {
    await sendPhoneOTPWithVihat(params);
  } else {
    throw new Error("Not supported");
  }
}

async function sendPhoneOTPWithVMG(params) {
  try {
    const res = await axios({
      method: "POST",
      url: `${process.appSettings.vmgBrandsmsApiUrl}/SMSBrandname/SendOTP`,
      headers: {
        token: process.appSettings.vmgBrandsmsToken,
        "Content-Type": "application/json",
      },
      data: {
        to: params.phone,
        from: process.appSettings.vmgBrandname,
        type: 1,
        message: `Levents thong bao ma OTP ${params.OTP} tren website https://levents.asia/ la ma xac minh cua ban. KHONG chia se ma cho bat ky ai duoi hinh thuc nao.`,
        scheduled: "",
        requestId: "",
        useUnicode: 0,
        ext: {},
      },
    });
    return res.data;
  } catch (error) {
    console.log(error);
  }
}

async function sendPhoneOTPWithVihat(params) {
  try {
    const res = await axios({
      method: "POST",
      url: `${process.appSettings.vihatApiUrl}/MainService.svc/json/SendMultipleMessage_V4_post_json/`,
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        ApiKey: process.appSettings.vihatApiKey,
        Content: `(LEVENTS) ${params.OTP} la ma xac thuc (OTP) cua ban tai website levents.asia. Vui long khong chia se ma xac thuc cho bat ky ai. Xin cam on va chuc ban mua sam vui ve!`,
        Phone: params.phone,
        SecretKey: process.appSettings.vihatSecretKey,
        IsUnicode: "0",
        Brandname: process.appSettings.vihatBrandname,
        SmsType: "2",
      },
    });
    return res.data;
  } catch (error) {
    console.log(error);
  }
}

module.exports = { sendPhoneOTP };
