const sgMail = require("@sendgrid/mail");

/**
 *
 * @param {Levents.SendEmailOTPParams} params
 */
async function sendEmailOTP(params) {
  sgMail.setApiKey(process.appSettings.sendgridApiKey);
  let text = `${params.OTP} là mã xác thực (OTP) của bạn tại website levents.asia. Vui lòng không chia sẻ mã xác thực dưới bất kỳ hình thức nào. Xin cảm ơn và chúc bạn mua sắm vui vẻ!`
  const msg = {
    to: params.email,
    from: process.appSettings.sendgridMailer, // Use the email address or domain you verified above
    subject: `${params.OTP} là mã xác thực (OTP) của bạn`,
    text: `${text}`,
    html: `<div>
      <p>LEVENTS</p>
      <p>${text}</p>
    </div>`,
  };
  try {
    await sgMail.send(msg);
  } catch (error) {
    console.error(error);

    if (error.response) {
      console.error(error.response.body);
    }
  }
}

module.exports = { sendEmailOTP };
