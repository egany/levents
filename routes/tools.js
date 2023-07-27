const express = require("express");
const router = express.Router();
const axios = require("axios").default;
const helper = require("../core/helper");

const { Session } = require("../model/session");
const { User } = require("../model/user");
const shopify = require("../lib/shopify");
const { API_URL } = process.env;

router.get("/clear-all", async (req, res, next) => {
  const result = {
    sessions: {
      clear: false,
      errors: [],
    },
    users: {
      clear: false,
      errors: [],
    },
  };

  try {
    await Session.deleteMany({});
    result.sessions.clear = true;
  } catch (error) {
    result.sessions.errors = [error];
  }

  try {
    await User.deleteMany({});
    result.users.clear = true;
  } catch (error) {
    result.users.errors = [error];
  }

  res.json(result);
});

router.get(
  "/test",
  init,
  test_tc_1,
  test_tc_2_1,
  test_tc_2_2,
  test_tc_3_1,
  test_tc_3_2,
  test_tc_4_1,
  test_tc_4_2_1,
  test_tc_4_2_2,
  test_tc_4_2_3,
  test_tc_5_1,
  test_tc_5_2
);

async function test_tc_5_2(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "5.2") {
      return next();
    }

    const test = {
      name: "Test case 5.2",
      description: "Email đã tồn tại, Phone chưa tồn tại trong hệ thống",
      accountType: "Not a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo đã trùng email",
        "Yêu cầu gửi OTP qua email",
        "Xác thực OTP nhận được từ email",
        "Đóng tab",
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo đã trùng email",
        "Yêu cầu gửi OTP qua email",
        "Xác thực OTP nhận được từ email",
        "Hiển thị thông tin, có thể thay nhập phone",
        "Yêu cầu gửi OTP SMS",
        "Xác thực OTP nhận được từ SMS",
        "Hiển thị thông tin",
        "Đăng ký",
        "Đi đến trang kích hoạt",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account7.phone,
      email: accounts.account7.email,
      fullName: accounts.account7.fullName,
      birthday: accounts.account7.birthday,
      gender: accounts.account7.gender,
    };

    let rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    rocr = await shopify.readOneCustomer({
      query: {
        email: payload.email,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    rocr = await shopify.createOneCustomer({
      ...accounts.account7,
      phone: null,
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    await helper.waitWithPromise(2000);

    if (params.run !== "true") {
      return res.json({
        message: "OK",
      });
    }

    await helper.waitWithPromise(2000);

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);
    await helper.waitWithPromise(2000);

    let task2 = {
      name: "Submit lần 2 - Yêu cầu gửi OTP qua email",
      payload: task1.response.data,
      response: {},
    };
    task2.response = await callRegisterAccount(task2.payload);
    test.tasks.push(task2);
    await helper.waitWithPromise(2000);

    let task3 = {
      name: "Submit lần 3 - Yêu cầu xác thực OTP từ email",
      payload: {
        ...task2.response.data,
        otpEmail: task2.response.data.otpEmail,
        otp: task2.response.data.otp,
      },
      response: {},
    };
    task3.response = await callRegisterAccount(task3.payload);
    test.tasks.push(task3);
    await helper.waitWithPromise(2000);

    let task4 = {
      name: "Submit lần 4 - Đóng tab và đăng ký lại",
      payload,
      response: {},
    };
    task4.response = await callRegisterAccount(task4.payload);
    test.tasks.push(task4);
    await helper.waitWithPromise(2000);

    let task5 = {
      name: "Submit lần 5 - Yêu cầu gửi OTP qua email",
      payload: task4.response.data,
      response: {},
    };
    task5.response = await callRegisterAccount(task5.payload);
    test.tasks.push(task5);
    await helper.waitWithPromise(2000);

    let task6 = {
      name: "Submit lần 6 - Yêu cầu xác thực OTP từ email",
      payload: {
        ...task5.response.data,
        otpEmail: task5.response.data.otpEmail,
        otp: task5.response.data.otp,
      },
      response: {},
    };
    task6.response = await callRegisterAccount(task6.payload);
    test.tasks.push(task6);
    await helper.waitWithPromise(2000);

    let task7 = {
      name: "Submit lần 7 - Nhập số điện thoại chưa tồn tại và yêu gửi OTP qua SMS",
      payload: { ...task6.response.data, phone: accounts.account7.phone },
      response: {},
    };
    task7.response = await callRegisterAccount(task7.payload);
    test.tasks.push(task7);
    await helper.waitWithPromise(2000);

    let task8 = {
      name: "Submit lần 8 - Yêu cầu xác thực OTP từ SMS",
      payload: {
        ...task7.response.data,
        otpPhone: task7.response.data.otpPhone,
        otp: task7.response.data.otp,
      },
      response: {},
    };
    task8.response = await callRegisterAccount(task8.payload);
    test.tasks.push(task8);
    await helper.waitWithPromise(2000);

    let task9 = {
      name: "Submit lần 9 - Yêu đăng ký",
      payload: task8.response.data,
      response: {},
    };
    task9.response = await callRegisterAccount(task9.payload);
    test.tasks.push(task9);
    await helper.waitWithPromise(2000);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_5_1(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "5.1") {
      return next();
    }

    const test = {
      name: "Test case 5.1",
      description: "Email đã tồn tại, Phone chưa tồn tại",
      accountType: "Has a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo tài khoản đã tồn tại",
        "Quên mật khẩu hoặc thay đổi thông tin",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account7.phone,
      email: accounts.account1.email,
      fullName: accounts.account7.fullName,
      birthday: accounts.account7.birthday,
      gender: accounts.account7.gender,
    };

    let rocr = await shopify.readOneCustomer({
      query: {
        email: payload.email,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (!rocr.data || rocr.data.state !== shopify.customerState.ENABLED) {
      return res.json({
        message: "Cần kích hoạt tài khoản Account 1",
      });
    }

    rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    if (params.run !== "true") {
      return res.json({
        message: "OK",
      });
    }

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_4_2_3(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "4.2.3") {
      return next();
    }

    const test = {
      name: "Test case 4.2.3",
      description:
        "Email chưa tồn tại & Phone đã tồn tại. Nếu nhập email đã tồn tại -> Thông báo trùng email",
      accountType: "Not a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo đã trùng số điện thoại",
        "Yêu cầu gửi OTP SMS",
        "Xác thực OTP",
        "Hiển thị thông tin",
        "Thay đổi email đã tồn tồn tại",
        "Đăng ký",
        "Thông báo đã trùng email",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account6.phone,
      email: accounts.account6.email,
      fullName: accounts.account6.fullName,
      birthday: accounts.account6.birthday,
      gender: accounts.account6.gender,
    };

    let rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    rocr = await shopify.createOneCustomer({
      ...accounts.account6,
      email: null,
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    await helper.waitWithPromise(2000);

    rocr = await shopify.readOneCustomer({
      query: {
        email: payload.email,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    if (params.run !== "true") {
      return res.json({
        message: "OK",
      });
    }

    await helper.waitWithPromise(2000);

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);
    await helper.waitWithPromise(2000);

    let task2 = {
      name: "Submit lần 2 - Yêu cầu gửi OTP qua số điện thoại",
      payload: task1.response.data,
      response: {},
    };
    task2.response = await callRegisterAccount(task2.payload);
    test.tasks.push(task2);
    await helper.waitWithPromise(2000);

    let task3 = {
      name: "Submit lần 3 - Yêu cầu xác thực OTP từ số điện thoại",
      payload: {
        ...task2.response.data,
        otpPhone: task2.response.data.otpPhone,
        otp: task2.response.data.otp,
      },
      response: {},
    };
    task3.response = await callRegisterAccount(task3.payload);
    test.tasks.push(task3);
    await helper.waitWithPromise(2000);

    let task4 = {
      name: "Submit lần 4 - Yêu cầu đăng ký tài khoản với email mới đã tồn tại",
      payload: {
        ...task3.response.data,
        email: accounts.account5.email,
      },
      response: {},
    };
    task4.response = await callRegisterAccount(task4.payload);
    test.tasks.push(task4);
    await helper.waitWithPromise(2000);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_4_2_2(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "4.2.2") {
      return next();
    }

    const test = {
      name: "Test case 4.2.2",
      description:
        "Email chưa tồn tại & Phone đã tồn tại. Nếu nhập email chưa tồn tại -> Tạo tài khoản theo thông tin đã có",
      accountType: "Not a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo đã trùng số điện thoại",
        "Yêu cầu gửi OTP SMS",
        "Xác thực OTP",
        "Hiển thị thông tin",
        "Thay đổi email chưa tồn tại",
        "Đăng ký",
        "Đi đến trang kích hoạt",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account5.phone,
      email: accounts.account5.email,
      fullName: accounts.account5.fullName,
      birthday: accounts.account5.birthday,
      gender: accounts.account5.gender,
    };

    let rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    rocr = await shopify.createOneCustomer({
      ...accounts.account5,
      email: null,
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    await helper.waitWithPromise(2000);

    rocr = await shopify.readOneCustomer({
      query: {
        email: payload.email,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    if (params.run !== "true") {
      return res.json({
        message: "OK",
      });
    }

    await helper.waitWithPromise(2000);

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);
    await helper.waitWithPromise(2000);

    let task2 = {
      name: "Submit lần 2 - Yêu cầu gửi OTP qua số điện thoại",
      payload: task1.response.data,
      response: {},
    };
    task2.response = await callRegisterAccount(task2.payload);
    test.tasks.push(task2);
    await helper.waitWithPromise(2000);

    let task3 = {
      name: "Submit lần 3 - Yêu cầu xác thực OTP từ số điện thoại",
      payload: {
        ...task2.response.data,
        otpPhone: task2.response.data.otpPhone,
        otp: task2.response.data.otp,
      },
      response: {},
    };
    task3.response = await callRegisterAccount(task3.payload);
    test.tasks.push(task3);
    await helper.waitWithPromise(2000);

    let task4 = {
      name: "Submit lần 4 - Yêu cầu đăng ký tài khoản với email mới chưa tồn tại",
      payload: {
        ...task3.response.data,
        email: accounts.account5.email,
      },
      response: {},
    };
    task4.response = await callRegisterAccount(task4.payload);
    test.tasks.push(task4);
    await helper.waitWithPromise(2000);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_4_2_1(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "4.2.1") {
      return next();
    }

    const test = {
      name: "Test case 4.2.1",
      description:
        "Email chưa tồn tại & Phone đã tồn tại. Tài khoản vừa xác thực OTP (SMS) có tồn tại email",
      accountType: "Not a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo đã trùng số điện thoại",
        "Yêu cầu gửi OTP SMS",
        "Xác thực OTP",
        "Hiển thị thông tin",
        "Đăng ký",
        "Đi đến trang kích hoạt",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account4.phone,
      email: accounts.account5.email,
      fullName: accounts.account4.fullName,
      birthday: accounts.account4.birthday,
      gender: accounts.account4.gender,
    };

    let rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    rocr = await shopify.createOneCustomer(accounts.account4);

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    await helper.waitWithPromise(2000);

    rocr = await shopify.readOneCustomer({
      query: {
        email: payload.email,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    if (params.run !== "true") {
      return res.json({
        message: "OK",
      });
    }

    await helper.waitWithPromise(2000);

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);
    await helper.waitWithPromise(2000);

    let task2 = {
      name: "Submit lần 2 - Yêu cầu gửi OTP qua số điện thoại",
      payload: task1.response.data,
      response: {},
    };
    task2.response = await callRegisterAccount(task2.payload);
    test.tasks.push(task2);
    await helper.waitWithPromise(2000);

    let task3 = {
      name: "Submit lần 3 - Yêu cầu xác thực OTP từ số điện thoại",
      payload: {
        ...task2.response.data,
        otpPhone: task2.response.data.otpPhone,
        otp: task2.response.data.otp,
      },
      response: {},
    };
    task3.response = await callRegisterAccount(task3.payload);
    test.tasks.push(task3);
    await helper.waitWithPromise(2000);

    let task4 = {
      name: "Submit lần 4 - Yêu cầu đăng ký tài khoản",
      payload: {
        ...task3.response.data,
      },
      response: {},
    };
    task4.response = await callRegisterAccount(task4.payload);
    test.tasks.push(task4);
    await helper.waitWithPromise(2000);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_4_1(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "4.1") {
      return next();
    }

    const test = {
      name: "Test case 4.1",
      description: "Email chưa tồn tại & Phone đã tồn tại",
      accountType: "Has a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo tài khoản đã tồn tại",
        "Quên mật khẩu hoặc thay đổi thông tin",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account1.phone,
      email: accounts.account4.email,
      fullName: accounts.account4.fullName,
      birthday: accounts.account4.birthday,
      gender: accounts.account4.gender,
    };

    let rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (!rocr.data || rocr.data.state !== shopify.customerState.ENABLED) {
      return res.json({
        message: "Cần kích hoạt tài khoản Account 1",
      });
    }

    rocr = await shopify.readOneCustomer({
      query: {
        email: payload.email,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    if (!rocr.data) {
      rocr = await shopify.createOneCustomer({
        ...accounts.account4,
        email: null,
      });
    }

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    await helper.waitWithPromise(2000);

    if (params.run !== "true") {
      return res.json({
        message: "OK",
      });
    }

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_3_2(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "3.2") {
      return next();
    }

    const test = {
      name: "Test case 3.2",
      description: "Email đã tồn tại & Phone đã tồn tại & Không cùng tài khoản",
      accountType: "Not a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo đã trùng số điện thoại",
        "Yêu cầu gửi OTP SMS",
        "Xác thực OTP",
        "Hiển thị thông tin",
        "Đăng ký",
        "Đi đến trang kích hoạt",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account3.phone,
      email: accounts.account1.email,
      fullName: accounts.account3.fullName,
      birthday: accounts.account3.birthday,
      gender: accounts.account3.gender,
    };

    let rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    rocr = await shopify.createOneCustomer(accounts.account3);

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    await helper.waitWithPromise(2000);

    rocr = await shopify.readOneCustomer({
      query: {
        email: payload.email,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (!rocr.data || rocr.data.state !== shopify.customerState.ENABLED) {
      return res.json({
        message: "Cần kích hoạt tài khoản Account 1",
      });
    }

    if (params.run !== "true") {
      return res.json({
        message: "OK",
      });
    }

    await helper.waitWithPromise(2000);

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);
    await helper.waitWithPromise(2000);

    let task2 = {
      name: "Submit lần 2 - Yêu cầu gửi OTP qua số điện thoại",
      payload: task1.response.data,
      response: {},
    };
    task2.response = await callRegisterAccount(task2.payload);
    test.tasks.push(task2);
    await helper.waitWithPromise(2000);

    let task3 = {
      name: "Submit lần 3 - Yêu cầu xác thực OTP từ số điện thoại",
      payload: {
        ...task2.response.data,
        otpPhone: task2.response.data.otpPhone,
        otp: task2.response.data.otp,
      },
      response: {},
    };
    task3.response = await callRegisterAccount(task3.payload);
    test.tasks.push(task3);
    await helper.waitWithPromise(2000);

    let task4 = {
      name: "Submit lần 4 - Yêu cầu đăng ký tài khoản",
      payload: {
        ...task3.response.data,
      },
      response: {},
    };
    task4.response = await callRegisterAccount(task4.payload);
    test.tasks.push(task4);
    await helper.waitWithPromise(2000);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_3_1(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "3.1") {
      return next();
    }

    const test = {
      name: "Test case 3.1",
      description: "Email đã tồn tại & Phone đã tồn tại & Không cùng tài khoản",
      accountType: "Has a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo tài khoản đã tồn tại",
        "Quên mật khẩu hoặc thay đổi thông tin",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account1.phone,
      email: accounts.account2.email,
      fullName: accounts.account1.fullName,
      birthday: accounts.account1.birthday,
      gender: accounts.account1.gender,
    };

    let rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (!rocr.data || rocr.data.state !== shopify.customerState.ENABLED) {
      return res.json({
        message: "Cần kích hoạt tài khoản Account 1",
      });
    }

    rocr = await shopify.readOneCustomer({
      query: {
        email: payload.email,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (!rocr.data || rocr.data.state !== shopify.customerState.ENABLED) {
      return res.json({
        message: "Cần kích hoạt tài khoản Account 2",
      });
    }

    if (params.run !== "true") {
      return res.json({
        message: "OK",
      });
    }

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_2_2(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "2.2") {
      return next();
    }

    const test = {
      name: "Test case 2.2",
      description: "Email đã tồn tại & Phone đã tồn tại & Cùng tài khoản.",
      accountType: "Not a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo đã trùng email và số điện thoại",
        "Yêu cầu gửi OTP SMS",
        "Xác thực OTP",
        "Hiển thị thông tin",
        "Đăng ký",
        "Đi đến trang kích hoạt",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account2.phone,
      email: accounts.account2.email,
      fullName: accounts.account2.fullName,
      birthday: accounts.account2.birthday,
      gender: accounts.account2.gender,
    };

    let rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (!rocr.data) {
      rocr = await shopify.readOneCustomer({
        query: {
          email: payload.email,
        },
      });

      if (rocr.errors.length > 0) {
        return res.status(500).json(rocr);
      }
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }

      await helper.waitWithPromise(2000);
    }

    const cocr = await shopify.createOneCustomer(accounts.account2);

    await helper.waitWithPromise(2000);

    if (cocr.errors.length > 0) {
      return res.status(500).json(cocr);
    }

    if (params.run !== "true") {
      return res.json({ message: "OK" });
    }

    await helper.waitWithPromise(2000);

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);
    await helper.waitWithPromise(2000);

    let task2 = {
      name: "Submit lần 2 - Yêu cầu gửi OTP qua số điện thoại",
      payload: task1.response.data,
      response: {},
    };
    task2.response = await callRegisterAccount(task2.payload);
    test.tasks.push(task2);
    await helper.waitWithPromise(2000);

    let task3 = {
      name: "Submit lần 3 - Yêu cầu xác thực OTP từ số điện thoại",
      payload: {
        ...task2.response.data,
        otpPhone: task2.response.data.otpPhone,
        otp: task2.response.data.otp,
      },
      response: {},
    };
    task3.response = await callRegisterAccount(task3.payload);
    test.tasks.push(task3);
    await helper.waitWithPromise(2000);

    let task4 = {
      name: "Submit lần 4 - Yêu cầu đăng ký tài khoản",
      payload: {
        ...task3.response.data,
      },
      response: {},
    };
    task4.response = await callRegisterAccount(task4.payload);
    test.tasks.push(task4);
    await helper.waitWithPromise(2000);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_2_1(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "2.1") {
      return next();
    }

    const test = {
      name: "Test case 2.1",
      description: "Email đã tồn tại & Phone đã tồn tại & Cùng tài khoản.",
      accountType: "Has a classic account",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Thông báo tài khoản đã tồn tại",
        "Quên mật khẩu hoặc thay đổ thông tin",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account1.phone,
      email: accounts.account1.email,
      fullName: accounts.account1.fullName,
      birthday: accounts.account1.birthday,
      gender: accounts.account1.gender,
    };

    const rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (!rocr.data || rocr.data.state !== shopify.customerState.ENABLED) {
      return res.json({
        message: "Cần kích hoạt tài khoản Account 1",
      });
    }

    if (params.run !== "true") {
      return res.json({
        message: "OK",
      });
    }

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function test_tc_1(req, res, next) {
  try {
    const accounts = req.accounts;
    const params = req.query;

    if (params.tc !== "1") {
      return next();
    }

    const test = {
      name: "Test case 1",
      description: "Email chưa tồn tại & Phone chưa tồn tại",
      flows: [
        "Nhập thông tin",
        "Yêu cầu đăng ký",
        "Yêu cầu xác thực SMS",
        "Xác thực SMS",
        "Hiển thị thông tin",
        "Yêu cầu kích hoạt tài khoản",
      ],
      tasks: [],
    };

    let payload = {
      phone: accounts.account1.phone,
      email: accounts.account1.email,
      fullName: accounts.account1.fullName,
      birthday: accounts.account1.birthday,
      gender: accounts.account1.gender,
    };

    const rocr = await shopify.readOneCustomer({
      query: {
        phone: payload.phone,
      },
    });

    if (rocr.errors.length > 0) {
      return res.status(500).json(rocr);
    }

    if (rocr.data) {
      const docr = await shopify.deleteOneCustomer({ id: rocr.data.id });

      if (docr.errors.length > 0) {
        return res.status(500).json(docr);
      }
    }

    if (params.run !== "true") {
      return res.json({ message: "OK" });
    }

    let task1 = {
      name: "Submit lần 1 - Yêu cầu đăng ký",
      payload,
      response: {},
    };
    task1.response = await callRegisterAccount(task1.payload);
    test.tasks.push(task1);

    let task2 = {
      name: "Submit lần 2 - Yêu cầu gửi OTP qua số điện thoại",
      payload: task1.response.data,
      response: {},
    };
    task2.response = await callRegisterAccount(task2.payload);
    test.tasks.push(task2);

    let task3 = {
      name: "Submit lần 3 - Yêu cầu xác thực OTP từ số điện thoại",
      payload: {
        ...task2.response.data,
        otpPhone: task2.response.data.otpPhone,
        otp: task2.response.data.otp,
      },
      response: {},
    };
    task3.response = await callRegisterAccount(task3.payload);
    test.tasks.push(task3);

    return res.json(test);
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function init(req, res, next) {
  const accounts = {};

  for (let i = 0; i <= 10; i++) {
    const id = i + 1;
    accounts[`account${id}`] = {
      phone: `03830000${id < 10 ? "0" + id : id}`,
      email: `account${id}@gmail.com`,
      fullName: `Account ${id}`,
      birthday: "1995-05-05T08:17:37.154Z",
      gender: "Nam",
      lastName: `Account ${id}`,
    };

    if (id !== 1) {
      accounts[`account${id}`].metafields = [
        {
          key: "currentPoints",
          namespace: "membership",
          type: "number_integer",
          value: "100",
        },
        {
          key: "currentRewardPointsLVS",
          namespace: "membership",
          type: "number_integer",
          value: "200",
        },
        {
          key: "fullName",
          namespace: "levents",
          type: "single_line_text_field",
          value: `Account ${id}`,
        },
        {
          key: "dateOfBirth",
          namespace: "levents",
          type: "single_line_text_field",
          value: "1995-05-05T08:17:37.154Z",
        },
        {
          key: "gender",
          namespace: "levents",
          type: "single_line_text_field",
          value: "Nam",
        },
        {
          key: "odooCustomerId",
          namespace: "levents",
          type: "single_line_text_field",
          value: `30${id}`,
        },
      ];
    }
  }

  req.accounts = accounts;

  next();
}

async function callRegisterAccount(payload) {
  try {
    const res = await axios.post(`${API_URL}/accounts/register`, payload);
    return res.data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(error.response.data);
      return error.response.data;
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.log(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log("Error", error.message);
    }
    console.log(error.config);

    return {
      errorMessage: error.message,
    };
  }
}

module.exports = router;
