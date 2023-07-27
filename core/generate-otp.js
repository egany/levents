const { parsePhoneNumber } = require("libphonenumber-js");
const { User } = require("../model/user");
const { createError, ERR_FORBIDDEN } = require("./errors");
const { responseCodes } = require("./response-codes");

/**
 *
 * @param {Levents.GenerateOTPParams} params
 * @returns {Promise<Levents.GenerateOTPResult>}
 */
async function generateOTP(params) {
  /**@type {Levents.GenerateOTPResult} */
  let result = {
    data: {},
    errors: [],
    meta: {
      otpAttempts: 0,
      otpCreateAttempts: 0,
      otpBlockedHour: process.appSettings.otpBlockedHour,
      otpExpires: process.appSettings.otpExpires,
      otpMaxAttempts: process.appSettings.otpMaxAttempts,
      otpMaxCreateAttempts: process.appSettings.otpMaxCreateAttempts,
      otpTestMode: process.appSettings.otpTestMode,
    },
  };

  /**@type {import('../model/user')} */
  let user;

  if (params.phone) {
    params.phone = params.phone.trim().toLowerCase();
    const parsedPhone = parsePhoneNumber(params.phone, "VN");
    let phoneNumber = parsedPhone.number;
    user = await User.findOne({
      phone: phoneNumber,
    });
    // If user does not exist, create a new user
    if (!user) {
      user = new User({
        phone: phoneNumber,
      });
    }
    result.data = {
      phone: phoneNumber,
    };
  } else {
    user = await User.findOne({
      email: params.email.trim().toLowerCase(),
    });
    // If user does not exist, create a new user
    if (!user) {
      user = new User({
        email: params.email.trim().toLowerCase(),
      });
    }
    result.data = {
      email: params.email,
    };
  }

  // If user is blocked, return an error
  if (user.isBlocked) {
    const currentTime = new Date();

    if (currentTime < user.blockUntil) {
      result.errors.push(
        createError({
          type: ERR_FORBIDDEN,
          code: 403,
          message: `You have exceeded the allowed number of times, or try again in ${process.appSettings.otpBlockedHour} hours.`,
          viMessage: `Bạn đã vượt quá số lần cho phép, hãy thử lại sau ${process.appSettings.otpBlockedHour} tiếng.`,
        })
      );
      result.meta.otpAttempts = user.OTPAttempts;
      result.meta.otpCreateAttempts = user.OTPCreateAttempts;
      result.meta.otpBlockUntil = user.blockUntil;
      result.meta.responseCode = responseCodes.otpBlocked;
      return result;
    } else {
      user.isBlocked = false;
      user.OTPAttempts = 0;
      user.OTPCreateAttempts = 0;
    }
  }

  if (user.OTPCreateAttempts >= process.appSettings.otpMaxCreateAttempts) {
    user.isBlocked = true;
    let blockUntil = new Date();
    blockUntil.setHours(
      blockUntil.getHours() + process.appSettings.otpBlockedHour
    );
    user.blockUntil = blockUntil;

    await user.save();

    result.errors.push(
      createError({
        type: ERR_FORBIDDEN,
        code: 403,
        message: `You have exceeded the allowed number of times, or try again in ${process.appSettings.otpBlockedHour} hours.`,
        viMessage: `Bạn đã vượt quá số lần cho phép, hãy thử lại sau ${process.appSettings.otpBlockedHour} tiếng.`,
      })
    );
    result.meta.otpAttempts = user.OTPAttempts;
    result.meta.otpCreateAttempts = user.OTPCreateAttempts;
    result.meta.otpBlockUntil = user.blockUntil;
    result.meta.responseCode = responseCodes.otpBlocked;
    return result;
  }

  // // Check for minimum 1-minute gap between OTP requests
  // const lastOTPTime = user.OTPCreatedTime;
  const currentTime = new Date();

  // if (lastOTPTime && currentTime - lastOTPTime < 60000) {
  //   return res
  //     .status(403)
  //     .send("Minimum 1-minute gap required between OTP requests");
  // }

  let digits = "0123456789";
  let OTP = "";
  for (let i = 0; i < 6; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }

  user.OTP = OTP;
  user.OTPCreatedTime = currentTime;
  user.OTPCreateAttempts++;

  await user.save();

  result.data = { ...result.data, OTP };
  result.meta.otpAttempts = user.OTPAttempts;
  result.meta.otpCreateAttempts = user.OTPCreateAttempts;
  result.meta.otpBlockUntil = user.blockUntil;
  result.meta.responseCode = responseCodes.success;
  return result;
}

module.exports = { generateOTP };
