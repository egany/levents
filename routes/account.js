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

router.post("/register", async (req, res) => {
  /**@type {Levents.Routes.RegisterAccountParams} */
  const params = req.body;
  /**@type {Levents.Routes.RegisterAccountResponse} */
  let result = {
    data: null,
    errors: [],
    meta: {},
  };

  try {
    let otpVerified = false;

    if (!params.email) {
      result.errors.push(
        createError({
          code: 400,
          type: ERR_INVALID_ARGS,
          fields: ["email"],
          message: "Missing the field",
          viMessage: "Thiếu thông tin",
        })
      );
      result.meta.responseCode = responseCodes.missingEmail;
    }

    if (!params.phone) {
      result.errors.push(
        createError({
          code: 400,
          type: ERR_INVALID_ARGS,
          fields: ["phone"],
          message: "Missing the field",
          viMessage: "Thiếu thông tin",
        })
      );

      if (result.meta.responseCode === responseCodes.missingEmail) {
        result.meta.responseCode = responseCodes.missingEmailPhone;
      } else {
        result.meta.responseCode = responseCodes.missingEmailPhone;
      }
    }

    if (result.errors.length > 0) {
      res.status(400).json(result);
      return;
    }

    params.phone = parsePhoneNumber(params.phone, "VN").number;

    if (params.otp) {
      let verifyOTPResult = params.otpPhone
        ? await verifyOTP({
            phone: params.phone,
            OTP: params.otp,
          })
        : await verifyOTP({
            email: params.email,
            OTP: params.otp,
          });

      if (verifyOTPResult.errors.length > 0) {
        res.status(403).json(verifyOTPResult);
        return;
      }

      otpVerified = true;
    }

    let rocr = await shopify.readOneCustomer({
      query: {
        email: params.email,
        phone: params.phone,
      },
    });

    if (rocr.errors.length > 0) {
      res.status(500).json(rocr);
      return;
    }

    let customer = rocr.data ? { ...rocr.data } : null;

    // Chưa có tài khoản
    if (!customer) {
      if (!params.needOTPVerification) {
        result.data = {
          ...params,
          needOTPVerification: true,
        };
        res.status(409).json(result);
        return;
      }

      if (params.needOTPVerification && !otpVerified) {
        const beginOTPResult = await beginOTP({
          params,
          res,
          result,
          phone: params.phone,
        });

        if (!beginOTPResult) {
          return;
        }

        result = beginOTPResult;
        res.json(result);
        return;
      }

      const coscr = await shopify.createOneCustomer({
        email: params.email,
        phone: params.phone,
        metafields: [
          {
            key: "name",
            namespace: "levents",
            type: "single_line_text_field",
            value: params.name,
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
            key: "registerDate",
            namespace: "levents",
            type: "single_line_text_field",
            value: new Date().toISOString(),
          },
        ],
        ...helper.parseName(params.name),
      });

      if (coscr.errors.length > 0) {
        res.status(500).json(coscr);
        return;
      }

      customer = { ...coscr.data };

      const gsaaur = await shopify.generateAccountActivationUrl({
        id: customer.id,
      });

      if (gsaaur.errors.length > 0) {
        res.status(500).json(gsaaur);
        return;
      }

      let fullName = helper.makeFullName(customer.firstName, customer.lastName);
      fullName = fullName !== "" ? fullName : params.name;

      res.json({
        data: {
          ...customer,
          name: fullName,
          accountActivationUrl: gsaaur.data.accountActivationUrl,
        },
        errors: [],
      });
      return;
    }

    const same =
      params.email === customer.email &&
      customer.phone &&
      helper.comparePhoneNumber(params.phone, customer.phone);

    const notHandleAccount =
      customer.state !== shopify.customerState.DISABLED &&
      customer.state !== shopify.customerState.ENABLED &&
      same;

    if (notHandleAccount) {
      result.errors.push(
        createError({
          code: 403,
          fields: [],
          type: ERR_CONFLICT,
          message: "Account blocked",
          viMessage: "Tài khoản này đã bị chặn",
        })
      );
      result.meta.responseCode = responseCodes.accountBlocked;
      res.status(409).json(result);
      return;
    }

    // Có email và phone cùng tài khoản
    if (customer.state === shopify.customerState.ENABLED && same) {
      if (!params.needOTPVerification) {
        result.errors.push(
          createError({
            code: 409,
            fields: ["email", "phone"],
            type: ERR_CONFLICT,
            message: "Email and phone number already exists",
            viMessage: "Email và số điện thoại đã tồn tại",
          })
        );
        result.meta.responseCode = responseCodes.conflictEmailPhone;
        res.status(409).json(result);
        return;
      }

      params.phone = customer.phone;
      params.email = customer.email;

      if (params.needOTPVerification && !otpVerified) {
        const beginOTPResult = await beginOTP({
          params,
          res,
          result,
          phone: customer.phone,
        });

        if (!beginOTPResult) {
          return;
        }

        result = beginOTPResult;
        res.json(result);
        return;
      }

      let fullName = helper.makeFullName(customer.firstName, customer.lastName);
      fullName = fullName !== "" ? fullName : params.name;
      result.data = customer;
      res.json(result);
      return;
    }

    rocr = await shopify.readOneCustomer({
      query: { email: params.email, phone: params.phone, id: customer.id },
      not: ["id"],
    });

    if (rocr.errors.length > 0) {
      res.status(500).json(rocr);
      return;
    }

    const otherCustomer = rocr.data ? { ...rocr.data } : null;

    // Có phone nhưng chưa tồn tại email
    if (
      (!otherCustomer || !otherCustomer?.email) &&
      customer.phone &&
      helper.comparePhoneNumber(customer.phone, params.phone)
    ) {
      if (!params.needOTPVerification) {
        result.errors.push(
          createError({
            code: 409,
            fields: ["phone"],
            type: ERR_CONFLICT,
            message: "Phone number already exists",
            viMessage: "Số điện thoại đã tồn tại",
          })
        );
        result.data = {
          ...params,
          needOTPVerification: true,
        };
        result.meta.responseCode = responseCodes.conflictPhone;
        res.status(409).json(result);
        return;
      }

      if (params.needOTPVerification && !otpVerified) {
        const beginOTPResult = await beginOTP({
          params,
          res,
          result,
          phone: customer.phone,
        });

        if (!beginOTPResult) {
          return;
        }

        result = beginOTPResult;
        res.json(result);
        return;
      }

      if (
        customer.state === shopify.customerState.DISABLED &&
        !customer.email
      ) {
        const uocr = await shopify.updateOneCustomer({
          id: customer.id,
          email: params.email,
        });

        if (uocr.errors.length > 0) {
          res.status(500).json(uocr);
          return;
        }

        customer = uocr.data;
      }

      let accountActivationUrl;

      if (customer.state === shopify.customerState.DISABLED && customer.email) {
        const gaaur = await shopify.generateAccountActivationUrl({
          id: customer.id,
        });

        if (gaaur.errors.length > 0) {
          res.status(500).json(gaaur);
          return;
        }

        accountActivationUrl = gaaur.data.accountActivationUrl;
      }

      let fullName = helper.makeFullName(customer.firstName, customer.lastName);
      fullName = fullName !== "" ? fullName : params.name;

      res.json({
        data: {
          ...customer,
          name: fullName,
          accountActivationUrl,
        },
        errors: [],
      });
      return;
    }

    // Có email nhưng chưa có phone
    if (
      customer.email === params.email &&
      (!otherCustomer || !otherCustomer?.phone) &&
      !customer.phone
    ) {
      const metafieldsObj = shopify.convertMetafieldsToObject(
        customer.metafields || []
      );

      if (
        metafieldsObj.needPhoneVerification &&
        metafieldsObj.emailVerified &&
        !params.needOTPVerification
      ) {
        result.errors.push(
          createError({
            code: 409,
            fields: ["email"],
            type: ERR_CONFLICT,
            message: "Email already exists",
            viMessage: "Email đã tồn tại",
          })
        );
        result.data = {
          ...params,
          needOTPVerification: true,
        };
        result.meta.responseCode = responseCodes.conflictEmail;
        res.status(409).json(result);
        return;
      }

      if (!params.needOTPVerification) {
        result.errors.push(
          createError({
            code: 409,
            fields: ["email"],
            type: ERR_CONFLICT,
            message: "Email already exists",
            viMessage: "Email đã tồn tại",
          })
        );
        result.data = {
          ...params,
          needOTPVerification: true,
        };
        result.meta.responseCode = responseCodes.conflictEmail;
        res.status(409).json(result);
        return;
      }

      if (
        metafieldsObj.needPhoneVerification &&
        metafieldsObj.emailVerified &&
        params.needOTPVerification &&
        !otpVerified
      ) {
        const beginOTPResult = await beginOTP({
          params,
          res,
          result,
          phone: params.phone,
        });

        if (!beginOTPResult) {
          return;
        }

        result = beginOTPResult;
        res.json(result);
        return;
      }

      if (params.needOTPVerification && !otpVerified) {
        const beginOTPResult = await beginOTP({
          params,
          res,
          result,
          email: customer.email,
        });

        if (!beginOTPResult) {
          return;
        }

        result = beginOTPResult;
        res.json(result);
        return;
      }

      if (
        !metafieldsObj.needPhoneVerification &&
        !metafieldsObj.emailVerified
      ) {
        const uocr = await shopify.updateOneCustomer({
          id: customer.id,
          metafields: [
            {
              namespace: "levents",
              key: "needPhoneVerification",
              type: "boolean",
              value: "true",
            },
            {
              namespace: "levents",
              key: "emailVerified",
              type: "boolean",
              value: "true",
            },
          ],
        });

        if (Array.isArray(uocr.errors) && uocr.errors.length > 0) {
          res.status(500).json(uocr);
          return;
        }

        delete params.otpEmail;
        delete params.otp;
        result.data = {
          ...params,
          needOTPVerification: true,
        };
        result.meta.responseCode = responseCodes.conflictEmail;
        res.status(409).json(result);
        return;
      }

      const uocr = await shopify.updateOneCustomer({
        id: customer.id,
        phone: params.phone,
      });

      if (Array.isArray(uocr.errors) && uocr.errors.length > 0) {
        res.status(500).json(uocr);
        return;
      }

      customer = { ...uocr.data };

      let accountActivationUrl;

      if (customer.state === shopify.customerState.DISABLED) {
        const gaaur = await shopify.generateAccountActivationUrl({
          id: customer.id,
        });

        if (gaaur.errors.length > 0) {
          res.status(500).json(gaaur);
          return;
        }

        accountActivationUrl = gaaur.data.accountActivationUrl;
      }

      let fullName = helper.makeFullName(customer.firstName, customer.lastName);
      fullName = fullName !== "" ? fullName : params.name;

      res.json({
        data: {
          ...customer,
          name: fullName,
          accountActivationUrl,
        },
        errors: [],
      });
      return;
    }

    // Có phone và email nhưng không cùng tài khoảng
    if (
      customer.email &&
      customer.phone &&
      otherCustomer?.email &&
      otherCustomer?.phone &&
      (customer.email !== otherCustomer?.email ||
        !helper.comparePhoneNumber(customer.phone, otherCustomer?.phone))
    ) {
      if (!params.needOTPVerification) {
        result.errors.push(
          createError({
            code: 409,
            fields: ["phone"],
            type: ERR_CONFLICT,
            message: "Phone number already exists",
            viMessage: "Số điện thoại đã tồn tại",
          })
        );
        result.data = {
          ...params,
          needOTPVerification: true,
        };
        result.meta.responseCode = responseCodes.conflictPhone;
        res.status(409).json(result);
        return;
      }

      if (params.needOTPVerification && !otpVerified) {
        const beginOTPResult = await beginOTP({
          params,
          res,
          result,
          phone: customer.phone,
        });

        if (!beginOTPResult) {
          return;
        }

        result = beginOTPResult;
        res.json(result);
        return;
      }

      let accountActivationUrl;

      if (customer.state === shopify.customerState.DISABLED) {
        const gaaur = await shopify.generateAccountActivationUrl({
          id: customer.id,
        });

        if (gaaur.errors.length > 0) {
          res.status(500).json(gaaur);
          return;
        }

        accountActivationUrl = gaaur.data.accountActivationUrl;
      }

      let fullName = helper.makeFullName(customer.firstName, customer.lastName);
      fullName = fullName !== "" ? fullName : params.name;

      res.json({
        data: {
          ...customer,
          name: fullName,
          accountActivationUrl,
        },
        errors: [],
      });
      return;
    }
  } catch (error) {
    console.error(error);
    result.errors(createError({}));
    result.meta.responseCode = responseCodes.serverError;
    res.status(500).json(result);
  }
});

/**
 *
 * @param {{
 * res: import('express').Response
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
