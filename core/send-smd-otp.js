const axios = require("axios").default;
/**
 *
 * @param {Levents.SendPhoneOTPParams} params
 * @returns {Promise<Levents.SendPhoneOTPResult>}
 */
async function sendPhoneOTP(params) {
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

module.exports = { sendPhoneOTP };
