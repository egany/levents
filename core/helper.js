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
  return (
    parsePhoneNumber(n1, "VN").number === parsePhoneNumber(n2, "VN").number
  );
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

  if (typeof lastName === "string" && lastName !== "") {
    fullName += lastName;
  }

  if (typeof firstName === "string" && firstName !== "") {
    if (fullName !== "") {
      fullName += " ";
    }

    fullName += firstName;
  }

  return fullName;
}

function makeCustomerResponseData(customer, params) {
  let fullName = makeFullName(customer.firstName, customer.lastName);
  fullName = fullName !== "" ? fullName : params.fullName;

  return {
    id: customer.id,
    displayName: customer.displayName,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    state: customer.state,
    tags: customer.tags,
    verifiedEmail: customer.verifiedEmail,
    metafields: customer.metafields,
    fullName,
    accountActivationUrl: customer.accountActivationUrl,
  };
}

async function waitWithPromise(ms = 500) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(ms);
    }, ms);
  });
}

module.exports = {
  parseName,
  makeFullName,
  comparePhoneNumber,
  generateSessionId,
  normalizePort,
  makeCustomerResponseData,
  waitWithPromise,
};
