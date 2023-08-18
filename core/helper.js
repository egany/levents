const { parsePhoneNumber } = require("libphonenumber-js");
const uuidv4 = require("uuid").v4;
const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet("1234567890qwertyuiopasdfghjklzxcvbnm", 10);

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

function generateLeventGlobalId() {
  return `Shopify_Levents_${nanoid()}${new Date().getTime()}`;
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

/**
 *
 * @param {Levents.Shopify.Metafield[]} metafields
 */
function convertMetafieldsToObject(metafields) {
  const obj = {};
  for (const m of metafields) {
    if (m.type === "boolean") {
      obj[m.key] = m.value === "true" ? true : false;
    } else if (m.type === "json") {
      obj[m.key] = JSON.parse(m.value);
    } else {
      obj[m.key] = m.value;
    }
  }
  return obj;
}

/**
 *
 * @param {Levents.Shopify.Metafield[]} metafields
 * @param {string} key
 */
function exportMetafieldValue(metafields, key) {
  const m = convertMetafieldsToObject(metafields);
  return m[key];
}
/**
 *
 * @param {Levents.Shopify.Metafield[]} metafields
 * @param {string} key
 */
function exportMetafieldId(metafields, key) {
  const m = metafields.find((_m) => _m.key === key);
  return m ? m.id : null;
}

function makeCustomerResponseData(customer, params, rewrite) {
  let resData = {
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
    accountActivationUrl: customer.accountActivationUrl,
    fullName: makeFullName(customer.firstName, customer.lastName),
    gender: exportMetafieldValue(customer.metafields, "gender"),
    dateOfBirth: exportMetafieldValue(customer.metafields, "dateOfBirth"),
  };

  if (!rewrite) {
    return resData;
  }

  if (!resData.email && params.email) {
    resData.email = params.email;
  }

  if (!resData.phone && params.phone) {
    resData.phone = params.phone;
  }

  if (!resData.gender && params.gender) {
    resData.gender = params.gender;
  }

  if (!resData.dateOfBirth && params.dateOfBirth) {
    resData.dateOfBirth = params.dateOfBirth;
  }

  for (const key of ["fullName", "dateOfBirth", "gender", "registeredDate"]) {
    if (exportMetafieldId(resData.metafields, key)) {
      const metafield = resData.metafields.find((m) => m.key === key);
      metafield.namespace = "levents";
      metafield.type = "single_line_text_field";
      metafield.value =
        key === "registeredDate" ? new Date().toISOString() : params[key];
    } else {
      resData.metafields.push({
        key,
        namespace: "levents",
        type: "single_line_text_field",
        value:
          key === "registeredDate" ? new Date().toISOString() : params[key],
      });
    }
  }

  if (!resData.firstName && !resData.lastName && params.fullName) {
    const { firstName, lastName } = parseName(params.fullName);
    resData.firstName = firstName;
    resData.lastName = lastName;
  }

  return resData;
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
  convertMetafieldsToObject,
  exportMetafieldId,
  exportMetafieldValue,
  generateLeventGlobalId,
};
