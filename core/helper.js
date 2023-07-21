const { parsePhoneNumber } = require("libphonenumber-js");
const uuidv4 = require("uuid").v4;

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  let port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

function generateSessionId() {
  return uuidv4();
}

/**
 *
 * @param {string} n1
 * @param {string} n2
 */
function comparePhoneNumber(n1, n2) {
  return parsePhoneNumber(n1).number === parsePhoneNumber(n2).number;
}

/**
 *
 * @param {string} name
 * @returns {{firstName:string;lastName:string}}
 */
function parseName(name) {
  name = name || "";
  name = name.trim();
  const chunks = name
    .split(" ")
    .map((c) => c.trim())
    .filter((c) => c && c !== "");
  const result = {
    firstName: "",
    lastName: "",
  };

  if (chunks.length === 1) {
    result.firstName = chunks[0];
    return result;
  }

  result.firstName = chunks[chunks.length - 1];

  for (let i = 0; i <= chunks.length - 2; i++) {
    if (result.lastName !== "") {
      result.lastName += " ";
    }

    result.lastName += chunks[i];
  }

  return result;
}

/**
 *
 * @param {string} firstName
 * @param {string} lastName
 */
function makeFullName(firstName, lastName) {
  if (!firstName && !lastName) return "";

  let fullName = "";

  if (lastName !== "") {
    fullName += lastName;
  }

  if (firstName !== "") {
    if (fullName !== "") {
      fullName += " ";
    }

    fullName += firstName;
  }

  return fullName;
}

module.exports = {
  parseName,
  makeFullName,
  comparePhoneNumber,
  generateSessionId,
  normalizePort,
};
