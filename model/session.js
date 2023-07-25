const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, index: true, unique: true },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
});

const Session = mongoose.model("Session", sessionSchema);

module.exports = {
  Session,
};
