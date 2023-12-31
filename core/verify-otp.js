const { parsePhoneNumber } = require("libphonenumber-js");
const { User } = require("../model/user");
const { createError, ERR_FORBIDDEN } = require("./errors");
const { responseCodes } = require("./response-codes");

/**
 *
 * @param {Levents.VerifyOTPParams} params
 * @returns {Promise<Levents.VerifyOTPResult>}
 */
async function verifyOTP(params) {
  /**@type {Levents.VerifyOTPResult} */
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
    const parsedPhone = parsePhoneNumber(params.phone, "VN");
    let phoneNumber = parsedPhone.number;
    user = await User.findOne({
      phone: phoneNumber,
    }).lean();
    // If user does not exist, create a new user
    if (!user) {
      await User.create({
        phone: phoneNumber,
      });

      user = await User.findOne({
        phone: phoneNumber,
      }).lean();
    }
    result.data = {
      phone: phoneNumber,
    };
  } else {
    user = await User.findOne({
      email: params.email.trim().toLowerCase(),
    }).lean();
    // If user does not exist, create a new user
    if (!user) {
      await User.create({
        email: params.email.trim().toLowerCase(),
      });

      user = await User.findOne({
        email: params.email.trim().toLowerCase(),
      }).lean();
    }
    result.data = {
      email: params.email,
    };
  }

  // Check if user account is blocked
  if (user.isBlocked) {
    const currentTime = new Date();
    const blockUntil = new Date(user.blockUntil);

    if (currentTime < blockUntil) {
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

  if (user.OTPAttempts >= process.appSettings.otpMaxAttempts) {
    user.isBlocked = true;
    let blockUntil = new Date();
    blockUntil.setHours(
      blockUntil.getHours() + process.appSettings.otpBlockedHour
    );
    user.blockUntil = blockUntil;

    await User.findByIdAndUpdate(user._id, user);

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

  // Check OTP
  if (user.OTP !== params.OTP) {
    user.OTPAttempts++;
    await User.findByIdAndUpdate(user._id, { ...user });
    result.errors.push(
      createError({
        type: ERR_FORBIDDEN,
        code: 403,
        message: "OTP verification failed",
        viMessage: "Mã OTP không chính xác",
      })
    );
    result.meta.otpAttempts = user.OTPAttempts;
    result.meta.otpCreateAttempts = user.OTPCreateAttempts;
    result.meta.otpBlockUntil = user.blockUntil;
    result.meta.responseCode = responseCodes.otpVerificationFailed;
    return result;
  }

  // Check if OTP is within 5 minutes
  const OTPCreatedTime = user.OTPCreatedTime;
  const currentTime = new Date();

  if (
    currentTime - OTPCreatedTime >
    process.appSettings.otpExpires * 60 * 1000
  ) {
    user.OTPAttempts++;
    await User.findByIdAndUpdate(user._id, { ...user });
    result.errors.push(
      createError({
        type: ERR_FORBIDDEN,
        code: 403,
        message: "OTP verification failed",
        viMessage: "Mã OTP không chính xác",
      })
    );
    result.meta.otpAttempts = user.OTPAttempts;
    result.meta.otpCreateAttempts = user.OTPCreateAttempts;
    result.meta.otpBlockUntil = user.blockUntil;
    result.meta.responseCode = responseCodes.otpVerificationFailed;
    return result;
  }

  // Clear OTP
  user.OTP = undefined;
  user.OTPCreatedTime = undefined;
  user.OTPAttempts = 0;
  user.OTPCreateAttempts = 0;

  await User.findByIdAndUpdate(user._id, { ...user });

  result.data = { verified: true };
  result.meta.otpAttempts = user.OTPAttempts;
  result.meta.otpCreateAttempts = user.OTPCreateAttempts;
  result.meta.otpBlockUntil = user.blockUntil;
  result.meta.responseCode = responseCodes.success;
  return result;
}

module.exports = { verifyOTP };
