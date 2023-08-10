const sgMail = require("@sendgrid/mail");

/**
 *
 * @param {Levents.SendEmailOTPParams} params
 */
async function sendEmailOTP(params) {
  sgMail.setApiKey(process.appSettings.sendgridApiKey);
  const msg = {
    to: params.email,
    from: process.appSettings.sendgridMailer, // Use the email address or domain you verified above
    subject: "Levents thong bao ma OTP",
    text: "Levents thong bao ma OTP",
    html: `<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
      <div style="margin:50px auto;width:70%;padding:20px 0">
        <div style="border-bottom:1px solid #eee">
          <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">${process.appSettings.brand}</a>
        </div>
        <p>Levents thong bao ma OTP ${params.OTP} tren website https://levents.asia/ la ma xac minh cua ban. KHONG chia se ma cho bat ky ai duoi hinh thuc nao.</p>
      </div>
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
