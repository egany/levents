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

userSchema.index({ email: 1}, { unique: true, sparse: true });
userSchema.index({ phone: 1}, { unique: true, sparse: true });

const User = mongoose.model("User", userSchema);

module.exports = {
  User,
};
