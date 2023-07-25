const express = require("express");
const router = express.Router();
const { parsePhoneNumber } = require("libphonenumber-js");
const { createError, ERR_INVALID_ARGS, ERR_CONFLICT } =
  require("../core").errors;
const {
  generateOTP,
  helper,
  sendEmailOTP,
  sendPhoneOTP,
  verifyOTP,
  responseCodes,
} = require("../core");
const { shopify } = require("../lib");
const { Session } = require("../model/session");

router.post(
  "/register",
  _init,
  _validate,
  _createOrUpdateSession,
  _standardizePhoneNumber,
  _verifyOTP,
  _readOneCustomer,
  _handleAccountNotExists,
  _handleBlockAccount,
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
    if (context.customer.state !== shopify.customerState.DISABLED) {
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
      context.result.data = {
        ...params,
        needOTPVerification: true,
      };
      context.result.meta.responseCode = responseCodes.conflictEmail;
      return res.status(409).json(context.result);
    }

    if (params.needOTPVerification && !context.otpVerified) {
      if (!req.session?.emailVerified) {
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
        return res.json(context.result);
      }

      const beginOTPResult = await beginOTP({
        params,
        res,
        result: context.result,
        phone: params.phone,
      });

      if (!beginOTPResult) {
        return;
      }

      context.result = beginOTPResult;
      return res.json(context.result);
    }

    if (
      params.needOTPVerification &&
      req.session?.emailVerified &&
      !req.session?.phoneVerified &&
      !params.otpPhone
    ) {
      context.result.errors.push(
        createError({
          code: 409,
          fields: ["email"],
          type: ERR_CONFLICT,
          message: "Email already exists",
          viMessage: "Email đã tồn tại",
        })
      );

      delete params.otpEmail;
      delete params.otp;

      context.result.data = {
        ...params,
        needOTPVerification: true,
      };
      context.result.meta.responseCode = responseCodes.conflictEmail;
      return res.status(409).json(context.result);
    }

    try {
      if (
        shopify.exportMetafieldId(context.customer.metafields, "registeredDate")
      ) {
        const _uocr = await shopify.updateOneCustomer({
          id: context.customer.id,
          metafields: [
            {
              id: shopify.exportMetafieldId(
                context.customer.metafields,
                "registeredDate"
              ),
              key: "registeredDate",
              namespace: "levents",
              type: "single_line_text_field",
              value: new Date().toISOString(),
            },
          ],
        });

        if (_uocr.errors.length > 0) {
          console.error(_uocr);
        }
      } else {
        const _uocr = await shopify.updateOneCustomer({
          id: context.customer.id,
          metafields: [
            {
              key: "registeredDate",
              namespace: "levents",
              type: "single_line_text_field",
              value: new Date().toISOString(),
            },
          ],
        });

        if (_uocr.errors.length > 0) {
          console.error(_uocr);
        }
      }
    } catch (error) {
      console.error(error);
    }

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    let fullName = helper.makeFullName(
      context.customer.firstName,
      context.customer.lastName
    );
    fullName = fullName !== "" ? fullName : params.fullName;

    return res.json({
      data: {
        ...context.customer,
        name: fullName,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      errors: [],
    });
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
    if (context.customer.state !== shopify.customerState.DISABLED) {
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
      context.result.errors.push(
        createError({
          code: 403,
          fields: ["email"],
          type: ERR_CONFLICT,
          message: "Email alredy exists",
          viMessage: "Email đã tồn tại",
        })
      );
      context.result.meta.responseCode = responseCodes.conflictEmail;
      return res.status(409).json(context.result);
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
      context.result.data = {
        ...params,
        needOTPVerification: true,
      };
      context.result.meta.responseCode = responseCodes.conflictPhone;
      return res.status(409).json(context.result);
    }

    if (params.needOTPVerification && !context.otpVerified) {
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
      return res.json(context.result);
    }

    if (!context.customer.email && params.email) {
      const uocr = await shopify.updateOneCustomer({
        id: context.customer.id,
        email: params.email,
      });

      if (uocr.errors.length > 0) {
        return res.status(500).json(uocr);
      }

      context.customer = { ...uocr.data };
    }

    try {
      if (
        shopify.exportMetafieldId(context.customer.metafields, "registeredDate")
      ) {
        const _uocr = await shopify.updateOneCustomer({
          id: context.customer.id,
          metafields: [
            {
              id: shopify.exportMetafieldId(
                context.customer.metafields,
                "registeredDate"
              ),
              key: "registeredDate",
              namespace: "levents",
              type: "single_line_text_field",
              value: new Date().toISOString(),
            },
          ],
        });

        if (_uocr.errors.length > 0) {
          console.error(_uocr);
        }
      } else {
        const _uocr = await shopify.updateOneCustomer({
          id: context.customer.id,
          metafields: [
            {
              key: "registeredDate",
              namespace: "levents",
              type: "single_line_text_field",
              value: new Date().toISOString(),
            },
          ],
        });

        if (_uocr.errors.length > 0) {
          console.error(_uocr);
        }
      }
    } catch (error) {
      console.error(error);
    }

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    let fullName = helper.makeFullName(
      context.customer.firstName,
      context.customer.lastName
    );
    fullName = fullName !== "" ? fullName : params.fullName;

    return res.json({
      data: {
        ...context.customer,
        name: fullName,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      errors: [],
    });
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
async function _handleNotClassicAccountExistsWithNotSameEmailAndPhone(
  req,
  res,
  next
) {
  const params = req.body;
  const context = req.context;
  try {
    if (context.customer.state !== shopify.customerState.DISABLED) {
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
          fields: ["email", "phone"],
          type: ERR_CONFLICT,
          message: "Email and phone number already exists",
          viMessage: "Email và số điện thoại đã tồn tại",
        })
      );
      context.result.data = {
        ...params,
        needOTPVerification: true,
      };
      context.result.meta.responseCode = responseCodes.conflictEmailPhone;
      return res.status(409).json(context.result);
    }

    if (params.needOTPVerification && !context.otpVerified) {
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
      return res.json(context.result);
    }

    try {
      if (
        shopify.exportMetafieldId(context.customer.metafields, "registeredDate")
      ) {
        const _uocr = await shopify.updateOneCustomer({
          id: context.customer.id,
          metafields: [
            {
              id: shopify.exportMetafieldId(
                context.customer.metafields,
                "registeredDate"
              ),
              key: "registeredDate",
              namespace: "levents",
              type: "single_line_text_field",
              value: new Date().toISOString(),
            },
          ],
        });

        if (_uocr.errors.length > 0) {
          console.error(_uocr);
        }
      } else {
        const _uocr = await shopify.updateOneCustomer({
          id: context.customer.id,
          metafields: [
            {
              key: "registeredDate",
              namespace: "levents",
              type: "single_line_text_field",
              value: new Date().toISOString(),
            },
          ],
        });

        if (_uocr.errors.length > 0) {
          console.error(_uocr);
        }
      }
    } catch (error) {
      console.error(error);
    }

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    let fullName = helper.makeFullName(
      context.customer.firstName,
      context.customer.lastName
    );
    fullName = fullName !== "" ? fullName : params.fullName;

    return res.json({
      data: {
        ...context.customer,
        name: fullName,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      errors: [],
    });
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
    if (context.customer.state !== shopify.customerState.DISABLED) {
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

    // const rocr = await shopify.readOneCustomer({
    //   query: {
    //     email: params.email,
    //     phone: params.phone,
    //     id: context.customer.id,
    //   },
    //   not: ["id"],
    // });

    // if (rocr.errors.length > 0) {
    //   return res.status(500).json(rocr);
    // }

    // const otherCustomer = rocr.data ? { ...rocr.data } : null;

    // if (!otherCustomer) {
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
      context.result.data = {
        ...params,
        needOTPVerification: true,
      };
      context.result.meta.responseCode = responseCodes.conflictEmailPhone;
      return res.status(409).json(context.result);
    }

    if (params.needOTPVerification && !context.otpVerified) {
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
      return res.json(context.result);
    }

    try {
      if (
        shopify.exportMetafieldId(context.customer.metafields, "registeredDate")
      ) {
        const _uocr = await shopify.updateOneCustomer({
          id: context.customer.id,
          metafields: [
            {
              id: shopify.exportMetafieldId(
                context.customer.metafields,
                "registeredDate"
              ),
              key: "registeredDate",
              namespace: "levents",
              type: "single_line_text_field",
              value: new Date().toISOString(),
            },
          ],
        });

        if (_uocr.errors.length > 0) {
          console.error(_uocr);
        }
      } else {
        const _uocr = await shopify.updateOneCustomer({
          id: context.customer.id,
          metafields: [
            {
              key: "registeredDate",
              namespace: "levents",
              type: "single_line_text_field",
              value: new Date().toISOString(),
            },
          ],
        });

        if (_uocr.errors.length > 0) {
          console.error(_uocr);
        }
      }
    } catch (error) {
      console.error(error);
    }

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    let fullName = helper.makeFullName(
      context.customer.firstName,
      context.customer.lastName
    );
    fullName = fullName !== "" ? fullName : params.fullName;

    return res.json({
      data: {
        ...context.customer,
        name: fullName,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      errors: [],
    });
    // }

    // if (
    //   otherCustomer.email === context.customer.email &&
    //   !otherCustomer.phone
    // ) {

    // }

    // if (
    //   otherCustomer.phone &&
    //   helper.comparePhoneNumber(otherCustomer.phone, context.customer.phone) &&
    //   !otherCustomer.email
    // ) {
    // }
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

    // if (!params.needOTPVerification) {
    //   context.result.errors.push(
    //     createError({
    //       code: 409,
    //       fields: ["email", "phone"],
    //       type: ERR_CONFLICT,
    //       message: "Email and phone number already exists",
    //       viMessage: "Email và số điện thoại đã tồn tại",
    //     })
    //   );
    //   context.result.meta.responseCode = responseCodes.conflictEmailPhone;
    //   return res.status(409).json(context.result);
    // }

    // if (params.needOTPVerification && !context.otpVerified) {
    //   const beginOTPResult = await beginOTP({
    //     params,
    //     res,
    //     result: context.result,
    //     phone: customer.phone,
    //   });

    //   // END
    //   if (!beginOTPResult) {
    //     return;
    //   }

    //   context.result = beginOTPResult;
    //   return res.json(context.result);
    // }

    // let fullName = helper.makeFullName(
    //   context.customer.firstName,
    //   context.customer.lastName
    // );
    // fullName = fullName !== "" ? fullName : params.fullName;
    // context.result.data = context.customer;
    // return res.json(context.result);
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
async function _handleBlockAccount(req, res, next) {
  const context = req.context;
  try {
    if (
      context.customer.state !== shopify.customerState.DISABLED &&
      context.customer.state !== shopify.customerState.ENABLED
    ) {
      context.result.errors.push(
        createError({
          code: 403,
          fields: [],
          type: ERR_CONFLICT,
          message: "Blocked account",
          viMessage: "Tài khoản này đã bị chặn",
        })
      );
      context.result.meta.responseCode = responseCodes.accountBlocked;
      return res.status(409).json(result);
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
async function _handleAccountNotExists(req, res, next) {
  const params = req.body;
  const context = req.context;
  try {
    // Other case
    if (context.customer) {
      return next();
    }

    if (!params.needOTPVerification) {
      context.result.data = {
        ...params,
        needOTPVerification: true,
      };
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
      return res.json(context.result);
    }

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
          value: params.birthday,
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
      ],
      ...helper.parseName(params.fullName),
    });

    if (coscr.errors.length > 0) {
      return res.status(500).json(coscr);
    }

    context.customer = { ...coscr.data };

    const gsaaur = await shopify.generateAccountActivationUrl({
      id: context.customer.id,
    });

    if (gsaaur.errors.length > 0) {
      return res.status(500).json(gsaaur);
    }

    let fullName = helper.makeFullName(
      context.customer.firstName,
      context.customer.lastName
    );
    fullName = fullName !== "" ? fullName : params.fullName;

    return res.json({
      data: {
        ...context.customer,
        name: fullName,
        accountActivationUrl: gsaaur.data.accountActivationUrl,
      },
      errors: [],
    });
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
      return res.status(403).json(verifyOTPResult);
    }

    context.otpVerified = true;

    if (!req.session) {
      return next();
    }

    if (params.otpPhone) {
      req.session.phoneVerified = true;
      await Session.findOneAndUpdate(
        { sessionId: req.session.sessionId },
        {
          phoneVerified: true,
        }
      );
    } else if (params.otpEmail) {
      req.session.emailVerified = true;
      await Session.findOneAndUpdate(
        { sessionId: req.session.sessionId },
        {
          emailVerified: true,
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
    session = await Session.create({ sessionId: helper.generateSessionId() });
  }

  req.context.result.meta.sessionId = session?.sessionId;
  req.session = { ...session };

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
      data: null,
      errors: [],
      meta: {},
    },
    otpVerified: false,
  };
  next();
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

    result.data = {
      needOTPVerification: true,
    };

    if (generateOTPResult.data.phone) {
      result.data.otpPhone = true;
    } else {
      result.data.otpEmail = true;
    }

    if (process.appSettings.otpTestMode === 2) {
      result.data.otp = generateOTPResult.data.OTP;
    } else if (process.appSettings.otpTestMode === 1) {
      result.data.otp = generateOTPResult.data.OTP;

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
