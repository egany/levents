/**
 *
 * @param {Levents.SendEmailOTPParams} params
 */
async function sendEmailOTP(params) {
  sgMail.setApiKey(process.appSettings.sendgridApiKey);
  const msg = {
    to: params.email,
    from: process.appSettings.sendgridMailer, // Use the email address or domain you verified above
    subject: "Sending with Twilio SendGrid is Fun",
    text: "and easy to do anywhere, even with Node.js",
    html: `<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
      <div style="margin:50px auto;width:70%;padding:20px 0">
        <div style="border-bottom:1px solid #eee">
          <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">${process.appSettings.brand}</a>
        </div>
        <p style="font-size:1.1em">Hi,</p>
        <p>Thank you for choosing ${process.appSettings.brand}. Use the following OTP to complete your Sign Up procedures. OTP is valid for 5 minutes</p>
        <h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">${params.OTP}</h2>
        <p style="font-size:0.9em;">Regards,<br />${process.appSettings.brand}</p>
        <hr style="border:none;border-top:1px solid #eee" />
        <div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300">
          <p>${process.appSettings.brand} Inc</p>
          <p>1600 Amphitheatre Parkway</p>
          <p>California</p>
        </div>
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
