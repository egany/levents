const responseCodes = {
  success: 1,
  otpBlocked: 2,
  otpVerificationFailed: 3,
  invalidArgs: 4,
  serverError: 5,
  missingEmail: 6,
  missingPhone: 7,
  missingEmailPhone: 8,
  accountBlocked: 9,
  conflictEmailPhone: 10,
  conflictPhone: 11,
  conflictEmail: 12,
  emailVerifiedButNeedPhoneVerification: 14,
};

module.exports = {
  responseCodes,
};
