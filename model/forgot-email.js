const mongoose = require("mongoose");

const forgotEmailSchema = new mongoose.Schema({
  phone: { type: String },
  attempts: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  blockUntil: { type: Date },
  latestRequestedTime: { type: Date, default: new Date() }
});

const ForgotEmail = mongoose.model("ForgotEmail", forgotEmailSchema);

module.exports = {
  ForgotEmail,
};
