const express = require("express");
const router = express.Router();
const { parsePhoneNumber } = require("libphonenumber-js");
const {
  createError,
  ERR_INVALID_ARGS,
  ERR_CONFLICT,
  ERR_LIMITED,
  ERR_NOT_FOUND,
  ERR_FORBIDDEN,
} = require("../core").errors;
const {
  generateOTP,
  helper,
  sendEmailOTP,
  sendPhoneOTP,
  sendPhoneForgotEmail,
  verifyOTP,
  responseCodes,
} = require("../core");
const { shopify } = require("../lib");
const { Session } = require("../model/session");
const { ForgotEmail } = require("../model/forgot-email");
const { default: axios } = require("axios");
const { syncToJoy } = require("../core/helper");

router.post("/forgot-email", _forgotEmail);

router.post(
  "/register",
  _init,
  _validate,
  _createOrUpdateSession,
  _standardizePhoneNumber,
  _verifyOTP,
  _readOneCustomer,
  _handleAccountNotExists,
  _handleClassicAccountEmailExists,
  _handleClassicAccountExistsWithSameEmailAndPhone,
  _handleNotClassicAccountExistsWithSameEmailAndPhone,
  _handleClassicAccountExistsWithNotSameEmailAndPhone,
  _handleNotClassicAccountExistsWithNotSameEmailAndPhone,
  _handleClassicAccountEmailNotExistsAndPhoneExists,
  _handleNotClassicAccountEmailNotExistsAndPhoneExists,
  _handleNotClassicAccountEmailExistsAndPhoneNotExists
);

/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 */
async function _forgotEmail(req, res) {
  const params = req.body;
  const errors = [];

  try {
    if (!params.phone) {
      errors.push(
        createError({
          code: 400,
          type: ERR_INVALID_ARGS,
          fields: ["phone"],
          message: "Missing the field",
          viMessage: "Thiếu thông tin",
        })
      );
    } else if (parsePhoneNumber(params.phone, "VN").number.length != 12) {
      errors.push(
        createError({
          code: 400,
          type: ERR_INVALID_ARGS,
          fields: ["phone"],
          message: "Phone invalid",
          viMessage: "Số điện thoại không hợp lệ",
        })
      );
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    /**@type {import('../model/forgot-email')} */
    let _forgotEmail;
    const parsedPhone = parsePhoneNumber(params.phone, "VN");
    let phoneNumber = parsedPhone.number;
    _forgotEmail = await ForgotEmail.findOne({
      phone: phoneNumber,
    }).lean();
    // If it does not exist, create a new
    if (!_forgotEmail) {
      await ForgotEmail.create({
        phone: phoneNumber,
      });

      _forgotEmail = await ForgotEmail.findOne({
        phone: phoneNumber,
      }).lean();
    }

    // Check if is blocked
    if (_forgotEmail.isBlocked) {
      const currentTime = new Date();
      const blockUntil = new Date(_forgotEmail.blockUntil);

      if (currentTime < blockUntil) {
        errors.push(
          createError({
            type: ERR_FORBIDDEN,
            code: 403,
            message: `You have exceeded the allowed number of times, or try again in ${process.appSettings.otpBlockedHour} hours.`,
            viMessage: `Bạn đã vượt quá số lần cho phép, hãy thử lại sau ${process.appSettings.otpBlockedHour} tiếng.`,
            data: {
              ..._forgotEmail,
            },
          })
        );
        return res.status(403).json({ errors });
      } else {
        _forgotEmail.isBlocked = false;
        _forgotEmail.attempts = 0;
      }
    }

    if (_forgotEmail.attempts >= process.appSettings.otpMaxAttempts) {
      _forgotEmail.isBlocked = true;
      let blockUntil = new Date();
      blockUntil.setHours(
        blockUntil.getHours() + process.appSettings.otpBlockedHour
      );
      _forgotEmail.blockUntil = blockUntil;

      await ForgotEmail.findByIdAndUpdate(_forgotEmail._id, _forgotEmail);

      errors.push(
        createError({
          type: ERR_FORBIDDEN,
          code: 403,
          message: `You have exceeded the allowed number of times, or try again in ${process.appSettings.otpBlockedHour} hours.`,
          viMessage: `Bạn đã vượt quá số lần cho phép, hãy thử lại sau ${process.appSettings.otpBlockedHour} tiếng.`,
          data: {
            ..._forgotEmail,
          },
        })
      );
      return res.status(403).json({ errors });
    }

    _forgotEmail.attempts++;
    await ForgotEmail.findByIdAndUpdate(_forgotEmail._id, { ..._forgotEmail });

    let currentTime = new Date();
    let latestRequestedTime = new Date(_forgotEmail.latestRequestedTime);

    if (currentTime - latestRequestedTime < 3000) {
      errors.push(
        createError({
          type: ERR_LIMITED,
          code: 403,
          message: "You can only make each request after 3 seconds.",
          viMessage: "Bạn chỉ có thể thực hiện mỗi yêu cầu sau 3 giây.",
          data: {
            ..._forgotEmail,
          },
        })
      );
      return res.status(403).json({ errors });
    }

    _forgotEmail.latestRequestedTime = new Date();
    await ForgotEmail.findByIdAndUpdate(_forgotEmail._id, { ..._forgotEmail });

    const rocr = await shopify.readOneCustomer({
      query: {
        phone: params.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    let customer = rocr.data ? { ...rocr.data } : null;

    if (!customer) {
      errors.push(
        createError({
          code: 404,
          fields: [],
          type: ERR_NOT_FOUND,
          message: "Account not found",
          viMessage: "Tài khoản này không tồn tại",
        })
      );

      return res.status(404).json({ errors });
    }

    if (customer.state !== shopify.customerState.ENABLED) {
      errors.push(
        createError({
          code: 404,
          fields: [],
          type: ERR_NOT_FOUND,
          message: "Account not found",
          viMessage: "Tài khoản này không tồn tại",
        })
      );

      return res.status(404).json({ errors });
    }

    if (!customer.email) {
      errors.push(
        createError({
          code: 422,
          fields: [],
          type: ERR_NOT_FOUND,
          message: "Email not found",
          viMessage: "Tài khoản này không có email",
        })
      );

      return res.status(422).json({ errors });
    }

    await sendPhoneForgotEmail({ email: customer.email, phone: params.phone });

    res.json({ message: "ok" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "errors" });
  }
}

/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _handleNotClassicAccountEmailExistsAndPhoneNotExists(
  req,
  res,
  next
) {
  const params = req.body;
  const context = req.context;
  try {
    if (context.customer.state === shopify.customerState.ENABLED) {
      return next();
    }

    if (params.email !== context.customer.email) {
      return next();
    }

    if (
      params.phone &&
      context.customer.phone &&
      helper.comparePhoneNumber(params.phone, context.customer.phone)
    ) {
      return next();
    }

    const rocr = await shopify.readOneCustomer({
      query: {
        phone: params.phone,
        id: context.customer.id,
      },
      not: ["id"],
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    const otherCustomer = rocr.data ? { ...rocr.data } : null;

    if (otherCustomer) {
      return next();
    }

    if (!params.needOTPVerification) {
      context.result.errors.push(
        createError({
          code: 409,
          fields: ["email"],
          type: ERR_CONFLICT,
          message: "Email already exists",
          viMessage: "Email đã tồn tại",
        })
      );
      context.result.data.needOTPVerification = true;
      context.result.meta.responseCode = responseCodes.conflictEmail;

      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        { step: 1 }
      );

      return res.status(409).json(context.result);
    }

    if (params.needOTPVerification && !req.session.emailVerified) {
      const beginOTPResult = await beginOTP({
        params,
        res,
        result: context.result,
        email: context.customer.email,
      });

      if (!beginOTPResult) {
        return;
      }

      context.result = beginOTPResult;

      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        { step: 2 }
      );

      return res.json(context.result);
    }

    if (
      params.needOTPVerification &&
      req.session.emailVerified &&
      !req.session.phoneVerified &&
      req.session.step === 2
    ) {
      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        { step: 3 }
      );

      context.result.data = {
        ...context.customer,
        needOTPVerification: true,
        sessionId: req.session.sessionId,
      };

      return res.json(context.result);
    }

    if (
      params.needOTPVerification &&
      req.session.emailVerified &&
      !req.session.phoneVerified &&
      req.session.step === 3
    ) {
      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        { step: 4 }
      );

      context.result.data = {
        ...helper.makeCustomerResponseData(context.customer, params, true),
        needOTPVerification: true,
        sessionId: req.session.sessionId,
        phone: params.phone,
      };

      return res.json(context.result);
    }

    if (
      params.needOTPVerification &&
      req.session.emailVerified &&
      !req.session.phoneVerified &&
      req.session.step === 4
    ) {
      const beginOTPResult = await beginOTP({
        params,
        res,
        result: context.result,
        phone: params.phone,
      });

      if (!beginOTPResult) {
        return;
      }

      context.result.data = {
        ...helper.makeCustomerResponseData(context.customer, params, true),
        needOTPVerification: true,
        sessionId: req.session.sessionId,
        otpPhone: beginOTPResult.data.otpPhone,
        otp: beginOTPResult.data.otp,
        phone: params.phone,
      };

      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        { step: 5 }
      );

      return res.json(context.result);
    }

    if (
      params.needOTPVerification &&
      req.session.emailVerified &&
      req.session.phoneVerified &&
      req.session.step === 5
    ) {
      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        { step: 6 }
      );

      context.result.data = {
        ...helper.makeCustomerResponseData(context.customer, params, true),
        needOTPVerification: true,
        sessionId: req.session.sessionId,
        phone: params.phone,
      };

      return res.json(context.result);
    }

    const uocr = await shopify.updateOneCustomer({
      id: context.customer.id,
      phone: req.session.phone,
    });

    if (uocr.errors.length > 0) {
      return res.status(500).json(uocr);
    }

    context.customer = { ...uocr.data };

    if (context.customer) {
      context.customer.fullName =
        helper.makeFullName(
          context.customer.firstName,
          context.customer.lastName
        ) || params.fullName;
    }

    await _updateCustomer(req, res, next);

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    context.result.data = helper.makeCustomerResponseData(
      {
        ...context.customer,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      params
    );
    context.result.data.sessionId = req.session.sessionId;
    context.result.data.needOTPVerification = true;

    return res.json(context.result);
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _handleClassicAccountEmailExists(req, res, next) {
  const params = req.body;
  const context = req.context;
  try {
    if (context.customer.state !== shopify.customerState.ENABLED) {
      return next();
    }

    if (params.email !== context.customer.email) {
      return next();
    }

    context.result.errors.push(
      createError({
        code: 403,
        fields: [],
        type: ERR_CONFLICT,
        message: "Account already exists",
        viMessage: "Tài khoản này đã tồn tại",
      })
    );
    context.result.meta.responseCode =
      responseCodes.hasAClassicAccountWithEmail;
    return res.status(409).json(context.result);
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _handleNotClassicAccountEmailNotExistsAndPhoneExists(
  req,
  res,
  next
) {
  const params = req.body;
  const context = req.context;
  try {
    if (context.customer.state === shopify.customerState.ENABLED) {
      return next();
    }

    if (
      !context.customer.phone ||
      !params.phone ||
      !helper.comparePhoneNumber(params.phone, context.customer.phone)
    ) {
      return next();
    }

    if (!params.needOTPVerification) {
      context.result.errors.push(
        createError({
          code: 409,
          fields: ["phone"],
          type: ERR_CONFLICT,
          message: "Phone number already exists",
          viMessage: "Số điện thoại đã tồn tại",
        })
      );
      context.result.data.needOTPVerification = true;
      context.result.data.sessionId = req.session.sessionId;
      context.result.meta.responseCode = responseCodes.conflictPhone;

      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        {
          step: 1,
        }
      );

      return res.status(409).json(context.result);
    }

    if (
      params.needOTPVerification &&
      (!req.session.phoneVerified ||
        (params.phone &&
          req.session.phone &&
          !helper.comparePhoneNumber(params.phone, req.session.phone)))
    ) {
      const beginOTPResult = await beginOTP({
        params,
        res,
        result: context.result,
        phone: context.customer.phone,
      });

      if (!beginOTPResult) {
        return;
      }

      context.result = beginOTPResult;
      context.result.data.sessionId = req.session.sessionId;
      context.result.data.needOTPVerification = true;

      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        {
          step: 2,
        }
      );

      return res.json(context.result);
    }

    if (
      params.needOTPVerification &&
      req.session.phoneVerified &&
      req.session.step === 2
    ) {
      context.result.data = {
        ...context.customer,
        needOTPVerification: true,
        sessionId: req.session.sessionId,
      };

      await Session.findOneAndUpdate(
        { sessionId: req.session.sessionId },
        { step: 3 }
      );

      return res.json(context.result);
    }

    if (
      params.needOTPVerification &&
      req.session.phoneVerified &&
      req.session.step === 3
    ) {
      rocr = await shopify.readOneCustomer({
        query: {
          email: params.email,
        },
      });

      if (rocr.errors.length > 0) {
        return res.json(500).json(rocr);
      }

      if (rocr.data) {
        context.result.errors.push(
          createError({
            code: 409,
            fields: ["email"],
            type: ERR_CONFLICT,
            message: "Email already exists",
            viMessage: "Email đã tồn tại",
          })
        );
        context.result.data.needOTPVerification = true;
        context.result.data.sessionId = req.session.sessionId;
        context.result.data.email = null;
        context.result.meta.responseCode =
          responseCodes.conflictEmailWithPhoneExists;

        return res.status(409).json(context.result);
      } else {
        context.customer.email = params.email;
      }
    }

    const uocr = await shopify.updateOneCustomer({
      id: context.customer.id,
      email: params.email,
    });

    if (uocr.errors.length > 0) {
      return res.status(500).json(uocr);
    }

    context.customer = uocr.data ? { ...uocr.data } : null;

    await _updateCustomer(req, res, next);

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    context.result.data = helper.makeCustomerResponseData(
      {
        ...context.customer,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      params
    );

    context.result.data.sessionId = req.session.sessionId;
    context.result.data.needOTPVerification = true;

    return res.json(context.result);
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _handleClassicAccountEmailNotExistsAndPhoneExists(
  req,
  res,
  next
) {
  const params = req.body;
  const context = req.context;
  try {
    if (context.customer.state !== shopify.customerState.ENABLED) {
      return next();
    }

    if (
      !context.customer.phone ||
      !params.phone ||
      !helper.comparePhoneNumber(params.phone, context.customer.phone)
    ) {
      return next();
    }

    const rocr = await shopify.readOneCustomer({
      query: {
        email: params.email,
        id: context.customer.id,
      },
      not: ["id"],
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    const otherCustomer = rocr.data ? { ...rocr.data } : null;

    if (otherCustomer) {
      return next();
    }

    context.result.errors.push(
      createError({
        code: 403,
        fields: ["email", "phone"],
        type: ERR_CONFLICT,
        message: "Account already exists",
        viMessage: "Tài khoản này đã tồn tại",
      })
    );
    context.result.meta.responseCode =
      responseCodes.hasAClassicAccountWithEmail;
    return res.status(409).json(context.result);
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _handleNotClassicAccountExistsWithNotSameEmailAndPhone(
  req,
  res,
  next
) {
  const params = req.body;
  const context = req.context;
  try {
    if (context.customer.state === shopify.customerState.ENABLED) {
      return next();
    }

    if (
      !context.customer.phone ||
      !context.customer.email ||
      !params.email ||
      !params.phone
    ) {
      return next();
    }

    const same =
      params.email === context.customer.email &&
      helper.comparePhoneNumber(params.phone, context.customer.phone);

    if (same) {
      return next();
    }

    const rocr = await shopify.readOneCustomer({
      query: {
        email: params.email,
        phone: params.phone,
        id: context.customer.id,
      },
      not: ["id"],
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    const otherCustomer = rocr.data ? { ...rocr.data } : null;

    if (!otherCustomer) {
      return next();
    }

    if (!params.needOTPVerification) {
      context.result.errors.push(
        createError({
          code: 409,
          fields: ["phone"],
          type: ERR_CONFLICT,
          message: "Phone number already exists",
          viMessage: "Số điện thoại đã tồn tại",
        })
      );
      context.result.data.needOTPVerification = true;
      context.result.data.sessionId = req.session.sessionId;
      context.result.meta.responseCode = responseCodes.conflictPhone;

      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        {
          step: 1,
        }
      );

      return res.status(409).json(context.result);
    }

    if (params.needOTPVerification && !req.session.phoneVerified) {
      const beginOTPResult = await beginOTP({
        params,
        res,
        result: context.result,
        phone: context.customer.phone,
      });

      if (!beginOTPResult) {
        return;
      }

      context.result = beginOTPResult;
      context.result.data.sessionId = req.session.sessionId;
      context.result.data.needOTPVerification = true;

      await Session.findOneAndUpdate(
        {
          sessionId: req.session.sessionId,
        },
        {
          step: 2,
        }
      );

      return res.json(context.result);
    }

    if (
      params.needOTPVerification &&
      req.session.phoneVerified &&
      req.session.step === 2
    ) {
      context.result.data = {
        ...context.customer,
        needOTPVerification: true,
        sessionId: req.session.sessionId,
      };

      await Session.findOneAndUpdate(
        { sessionId: req.session.sessionId },
        { step: 3 }
      );

      return res.json(context.result);
    }

    await _updateCustomer(req, res, next);

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    context.result.data = helper.makeCustomerResponseData(
      {
        ...context.customer,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      params
    );
    context.result.data.sessionId = req.session.sessionId;
    context.result.data.needOTPVerification = true;

    return res.json(context.result);
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _handleClassicAccountExistsWithNotSameEmailAndPhone(
  req,
  res,
  next
) {
  const params = req.body;
  const context = req.context;
  try {
    if (context.customer.state !== shopify.customerState.ENABLED) {
      return next();
    }

    if (
      !context.customer.phone ||
      !context.customer.email ||
      !params.email ||
      !params.phone
    ) {
      return next();
    }

    const same =
      params.email === context.customer.email &&
      helper.comparePhoneNumber(params.phone, context.customer.phone);

    if (same) {
      return next();
    }

    const rocr = await shopify.readOneCustomer({
      query: {
        email: params.email,
        phone: params.phone,
        id: context.customer.id,
      },
      not: ["id"],
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    const otherCustomer = rocr.data ? { ...rocr.data } : null;

    if (!otherCustomer) {
      return next();
    }

    context.result.errors.push(
      createError({
        code: 403,
        fields: [],
        type: ERR_CONFLICT,
        message: "Account already exists",
        viMessage: "Tài khoản này đã tồn tại",
      })
    );
    context.result.meta.responseCode =
      responseCodes.hasAClassicAccountWithEmail;
    return res.status(409).json(context.result);
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _handleNotClassicAccountExistsWithSameEmailAndPhone(
  req,
  res,
  next
) {
  const params = req.body;
  const context = req.context;
  try {
    if (context.customer.state === shopify.customerState.ENABLED) {
      return next();
    }

    if (
      !context.customer.phone ||
      !context.customer.email ||
      !params.email ||
      !params.phone
    ) {
      return next();
    }

    const same =
      params.email === context.customer.email &&
      helper.comparePhoneNumber(params.phone, context.customer.phone);

    if (!same) {
      return next();
    }

    if (!params.needOTPVerification) {
      context.result.errors.push(
        createError({
          code: 409,
          fields: ["email", "phone"],
          type: ERR_CONFLICT,
          message: "Email and phone number already exists",
          viMessage: "Email và số điện thoại đã tồn tại",
        })
      );
      context.result.data.needOTPVerification = true;
      context.result.data.sessionId = req.session.sessionId;
      context.result.meta.responseCode = responseCodes.conflictEmailPhone;
      await Session.findOneAndUpdate(
        { sessionId: req.session.sessionId },
        { step: 1 }
      );
      return res.status(409).json(context.result);
    }

    if (params.needOTPVerification && !req.session.phoneVerified) {
      const beginOTPResult = await beginOTP({
        params,
        res,
        result: context.result,
        phone: context.customer.phone,
      });

      if (!beginOTPResult) {
        return;
      }

      context.result = beginOTPResult;
      context.result.data.needOTPVerification = true;
      context.result.data.sessionId = req.session.sessionId;

      await Session.findOneAndUpdate(
        { sessionId: req.session.sessionId },
        { step: 2 }
      );

      return res.json(context.result);
    }

    if (
      params.needOTPVerification &&
      req.session.phoneVerified &&
      req.session.step === 2
    ) {
      context.result.data = {
        ...context.customer,
        needOTPVerification: true,
        sessionId: req.session.sessionId,
      };

      await Session.findOneAndUpdate(
        { sessionId: req.session.sessionId },
        { step: 3 }
      );

      return res.json(context.result);
    }

    await _updateCustomer(req, res, next);

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    context.result.data = helper.makeCustomerResponseData(
      {
        ...context.customer,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      params
    );

    context.result.data.sessionId = req.session.sessionId;
    context.result.data.needOTPVerification = true;

    return res.json(context.result);
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _handleClassicAccountExistsWithSameEmailAndPhone(
  req,
  res,
  next
) {
  const params = req.body;
  const context = req.context;
  try {
    if (context.customer.state !== shopify.customerState.ENABLED) {
      return next();
    }

    if (
      !context.customer.phone ||
      !context.customer.email ||
      !params.email ||
      !params.phone
    ) {
      return next();
    }

    const same =
      params.email === context.customer.email &&
      helper.comparePhoneNumber(params.phone, context.customer.phone);

    if (!same) {
      return next();
    }

    context.result.errors.push(
      createError({
        code: 403,
        fields: [],
        type: ERR_CONFLICT,
        message: "Account already exists",
        viMessage: "Tài khoản này đã tồn tại",
      })
    );
    context.result.meta.responseCode =
      responseCodes.hasAClassicAccountWithEmail;
    return res.status(409).json(context.result);
  } catch (error) {
    return next(error);
  }
}

/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _handleAccountNotExists(req, res, next) {
  const params = req.body;
  const context = req.context;
  try {
    // Other case
    if (context.customer) {
      return next();
    }

    if (!params.needOTPVerification) {
      context.result.data.needOTPVerification = true;
      context.result.data.sessionId = req.session.sessionId;
      context.result.meta.responseCode = responseCodes.success;
      return res.status(409).json(context.result);
    }

    if (params.needOTPVerification && !context.otpVerified) {
      const beginOTPResult = await beginOTP({
        params,
        res,
        result: context.result,
        phone: params.phone,
      });

      // END
      if (!beginOTPResult) {
        return;
      }

      context.result = beginOTPResult;
      context.result.data.needOTPVerification = true;
      context.result.data.sessionId = req.session.sessionId;

      return res.json(context.result);
    }

    const ccid = helper.generateLeventGlobalId();
    const coscr = await shopify.createOneCustomer({
      email: params.email,
      phone: params.phone,
      metafields: [
        {
          key: "fullName",
          namespace: "levents",
          type: "single_line_text_field",
          value: params.fullName,
        },
        {
          key: "dateOfBirth",
          namespace: "levents",
          type: "single_line_text_field",
          value: params.dateOfBirth,
        },
        {
          key: "gender",
          namespace: "levents",
          type: "single_line_text_field",
          value: params.gender,
        },
        {
          key: "registeredDate",
          namespace: "levents",
          type: "single_line_text_field",
          value: new Date().toISOString(),
        },
        {
          key: "odooCustomerId",
          namespace: "levents",
          type: "single_line_text_field",
          value: ccid,
        },
      ],
      ...helper.parseName(params.fullName),
      tags: ccid,
    });

    if (coscr.errors.length > 0) {
      return res.status(500).json(coscr);
    }

    context.customer = { ...coscr.data };

    if (context.customer) {
      context.customer.fullName =
        helper.makeFullName(
          context.customer.firstName,
          context.customer.lastName
        ) || params.fullName;

      if (process.env.JOY_APP_ID && process.env.JOY_APP_SECRET) {
        // Sync dateOfBirth to Joy
        setTimeout(() => {
          syncToJoy(params.dateOfBirth, context.customer.id);
        }, 5000); // 3 minutes
      }
    }

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    context.result.data = helper.makeCustomerResponseData(
      {
        ...context.customer,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      params
    );
    context.result.data.needOTPVerification = true;
    context.result.data.sessionId = req.session.sessionId;

    return res.json(context.result);
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _readOneCustomer(req, res, next) {
  const params = req.body;
  const context = req.context;
  try {
    if (params.phone) {
      const rocr = await shopify.readOneCustomer({
        query: {
          phone: params.phone,
        },
      });

      if (rocr.errors.length > 0) {
        return res.status(500).json(rocr);
      }

      context.customer = rocr.data ? { ...rocr.data } : null;

      if (context.customer) {
        context.customer.fullName = helper.makeFullName(
          context.customer.firstName,
          context.customer.lastName
        );
      }
    }

    if (!context.customer) {
      const rocr = await shopify.readOneCustomer({
        query: {
          email: params.email,
        },
      });

      if (rocr.errors.length > 0) {
        return res.status(500).json(rocr);
      }

      context.customer = rocr.data ? { ...rocr.data } : null;
    }

    if (context.customer) {
      context.customer.fullName = helper.makeFullName(
        context.customer.firstName,
        context.customer.lastName
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _verifyOTP(req, res, next) {
  const params = req.body;
  const context = req.context;

  try {
    if (!params.otp) {
      return next();
    }

    let verifyOTPResult = params.otpPhone
      ? await verifyOTP({
          phone: context.standardizedPhoneNumber,
          OTP: params.otp,
        })
      : await verifyOTP({
          email: params.email,
          OTP: params.otp,
        });

    if (verifyOTPResult.errors.length > 0) {
      verifyOTPResult.data = {
        ...params,
        ...verifyOTPResult.data,
        sessionId: req.session.sessionId,
      };
      return res.status(403).json(verifyOTPResult);
    }

    context.otpVerified = true;

    if (!req.session) {
      return next();
    }

    if (params.otpPhone) {
      req.session.phoneVerified = true;
      req.session.phone = parsePhoneNumber(params.phone, "VN").number;
      await Session.findOneAndUpdate(
        { sessionId: req.session.sessionId },
        {
          phoneVerified: true,
          phone: req.session.phone,
        }
      );
    } else if (params.otpEmail) {
      req.session.emailVerified = true;
      req.session.email = params.email;
      await Session.findOneAndUpdate(
        { sessionId: req.session.sessionId },
        {
          emailVerified: true,
          email: params.email,
        }
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _standardizePhoneNumber(req, res, next) {
  const params = req.body;
  req.context.standardizedPhoneNumber = parsePhoneNumber(
    params.phone,
    "VN"
  ).number;
  return next();
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _createOrUpdateSession(req, res, next) {
  const params = req.body;
  let session;

  if (params.sessionId) {
    session = await Session.findOne({ sessionId: params.sessionId }).lean();
  } else {
    session = (
      await Session.create({ sessionId: helper.generateSessionId() })
    ).toObject();
  }

  if (session) {
    req.context.result.data.sessionId = session.sessionId;
  }

  req.context.result.meta.sessionId = session?.sessionId;
  req.session = session;

  return next();
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _validate(req, res, next) {
  const params = req.body;
  const context = req.context;

  try {
    if (!params.email) {
      context.result.errors.push(
        createError({
          code: 400,
          type: ERR_INVALID_ARGS,
          fields: ["email"],
          message: "Missing the field",
          viMessage: "Thiếu thông tin",
        })
      );
      context.result.meta.responseCode = responseCodes.missingEmail;
    } else if (!/(@)(.+)$/g.test(params.email)) {
      context.result.errors.push(
        createError({
          code: 400,
          type: ERR_INVALID_ARGS,
          fields: ["email"],
          message: "Email invalid",
          viMessage: "Email không hợp lệ",
        })
      );

      context.result.meta.responseCode = responseCodes.invalidPhoneOrEmail;
    }

    if (!params.phone) {
      context.result.errors.push(
        createError({
          code: 400,
          type: ERR_INVALID_ARGS,
          fields: ["phone"],
          message: "Missing the field",
          viMessage: "Thiếu thông tin",
        })
      );

      if (context.result.meta.responseCode === responseCodes.missingEmail) {
        context.result.meta.responseCode = responseCodes.missingEmailPhone;
      } else {
        context.result.meta.responseCode = responseCodes.missingEmailPhone;
      }
    } else if (parsePhoneNumber(params.phone, "VN").number.length != 12) {
      context.result.errors.push(
        createError({
          code: 400,
          type: ERR_INVALID_ARGS,
          fields: ["phone"],
          message: "Phone invalid",
          viMessage: "Số điện thoại không hợp lệ",
        })
      );

      context.result.meta.responseCode = responseCodes.invalidPhoneOrEmail;
    }

    if (context.result.errors.length > 0) {
      return res.status(400).json(context.result);
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _init(req, res, next) {
  req.context = {
    result: {
      data: { ...req.body },
      errors: [],
      meta: {},
    },
    otpVerified: false,
  };
  next();
}

/**
 *
 * @param {Levents.Routes.RegisterAccountRequest} req
 * @param {Levents.Routes.Response} res
 * @param {Levents.Routes.NextFunction} next
 */
async function _updateCustomer(req, res, next) {
  const params = req.body;
  const context = req.context;

  try {
    for (const key of ["fullName", "dateOfBirth", "gender", "registeredDate"]) {
      if (shopify.exportMetafieldId(context.customer.metafields, key)) {
        const metafield = context.customer.metafields.find(
          (m) => m.key === key
        );

        if (!metafield.value || metafield.value.trim() === "") {
          metafield.namespace = "levents";
          metafield.type = "single_line_text_field";
          metafield.value =
            key === "registeredDate" ? new Date().toISOString() : params[key];
        }
      } else {
        context.customer.metafields.push({
          key,
          namespace: "levents",
          type: "single_line_text_field",
          value:
            key === "registeredDate" ? new Date().toISOString() : params[key],
        });
      }
    }

    if (
      !context?.customer?.firstName &&
      !context?.customer?.lastName &&
      params.fullName
    ) {
      const { firstName, lastName } = helper.parseName(params.fullName);
      context.customer.firstName = firstName;
      context.customer.lastName = lastName;
    }

    const _uocr = await shopify.updateOneCustomer({
      id: context.customer.id,
      metafields: context.customer.metafields,
      firstName: context.customer.firstName,
      lastName: context.customer.lastName,
    });

    if (_uocr.errors.length > 0) {
      console.error(_uocr);
    }

    context.customer = _uocr.data ? { ..._uocr.data } : null;
  } catch (error) {
    console.error(error);
  }
}

/**
 *
 * @param {{
 * res: Levents.Routes.Response
 * params: Levents.Routes.RegisterAccountParams
 * phone?: string
 * email?: string
 * result: Levents.Routes.RegisterAccountResponse
 * }} args
 * @returns {Promise<Levents.Routes.RegisterAccountResponse | null>}
 */
async function beginOTP(args) {
  const { res, result, phone, email } = args;
  try {
    const generateOTPResult = phone
      ? await generateOTP({
          phone,
        })
      : await generateOTP({
          email,
        });

    if (generateOTPResult.errors.length > 0) {
      res.status(403).json(generateOTPResult);
      return null;
    }

    result.data.needOTPVerification = true;

    if (generateOTPResult.data.phone) {
      result.data.otpPhone = true;
    } else {
      result.data.otpEmail = true;
    }

    if (process.appSettings.otpTestMode === 2) {
      result.data.otp = generateOTPResult.data.OTP;
    } else {
      if (process.appSettings.otpTestMode === 1) {
        result.data.otp = generateOTPResult.data.OTP;
      }

      if (phone) {
        sendPhoneOTP({
          phone,
          OTP: generateOTPResult.data.OTP,
        });
      } else if (email) {
        sendEmailOTP({
          email,
          OTP: generateOTPResult.data.OTP,
        });
      }
    }

    return result;
  } catch (error) {
    console.error(error);
    result.errors.push(createError({}));
    result.meta.responseCode = responseCodes.serverError;
    res.status(403).json(result);
    return null;
  }
}

module.exports = router;
