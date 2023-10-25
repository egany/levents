const axios = require("axios").default;
/**
 *
 * @param {Levents.SendPhoneForgotEmailParams} params
 * @returns {Promise<Levents.SendPhoneForgotResult>}
 */
async function sendPhoneForgotEmail(params) {
  if (process.env.SMS_PROVIDER === "VMG") {
    await sendPhoneForgotEmailWithVMG(params);
  } else if (process.env.SMS_PROVIDER === "Vihat") {
    await sendPhoneForgotEmailWithVihat(params);
  } else {
    throw new Error("Not supported");
  }
}

async function sendPhoneForgotEmailWithVMG(params) {
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
        message: `Levents thong bao ma email ${params.email} tren website https://levents.asia/ la ma xac minh cua ban. KHONG chia se ma cho bat ky ai duoi hinh thuc nao.`,
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

async function sendPhoneForgotEmailWithVihat(params) {
  try {
    const res = await axios({
      method: "POST",
      url: `${process.appSettings.vihatApiUrl}/MainService.svc/json/SendMultipleMessage_V4_post_json/`,
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        ApiKey: process.appSettings.vihatApiKey,
        Content: `(LEVENTS) ${params.email} la ma xac thuc (email) cua ban tai website levents.asia. Vui long khong chia se ma xac thuc cho bat ky ai. Xin cam on va chuc ban mua sam vui ve!`,
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

module.exports = { sendPhoneForgotEmail };
