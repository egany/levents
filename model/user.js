const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String },
  phone: { type: String },
  OTP: { type: String },
  OTPCreatedTime: { type: Date },
  OTPAttempts: { type: Number, default: 0 },
  OTPCreateAttempts: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  blockUntil: { type: Date },
});

const User = mongoose.model("User", userSchema);

module.exports = {
  User,
};
