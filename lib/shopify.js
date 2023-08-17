require("@shopify/shopify-api/adapters/node");
const {
  shopifyApi,
  LATEST_API_VERSION,
  Session,
} = require("@shopify/shopify-api");
const uuidv4 = require("uuid").v4;
const { parsePhoneNumber } = require("libphonenumber-js");
const { createError, ERR_INVALID_ARGS } = require("../core").errors;
const { responseCodes, helper, errors } = require("../core");

/**@type {import('@shopify/shopify-api').Shopify} */
let _shopify;

function createShopify() {
  if (_shopify) return _shopify;

  _shopify = shopifyApi({
    apiVersion: LATEST_API_VERSION,
    scopes: ["write_customers"],
    hostName: process.appSettings.shopifyHostname,
    apiKey: process.appSettings.shopifyClientKey,
    apiSecretKey: process.appSettings.shopifyClientSecret,
  });

  return _shopify;
}

function createSession() {
  return new Session({
    shop: process.appSettings.shopifyHostname,
    accessToken: process.appSettings.shopifyAccessToken,
    state: uuidv4(),
    isOnline: false,
    id: uuidv4(),
  });
}

function createGraphqlClient() {
  const shopify = createShopify();
  return new shopify.clients.Graphql({ session: createSession() });
}

const customerState = {
  DECLINED: "DECLINED",
  DISABLED: "DISABLED",
  ENABLED: "ENABLED",
  INVITED: "INVITED",
};

/**
 *
 * @param {Levents.Shopify.ReadManyBasicDiscountCodesParams} params
 * @returns {Promise<Levents.Shopify.ReadManyBasicDiscountCodesResult>}
 */
async function readManyBasicDiscountCodes(params) {
  try {
    /**@type {Levents.Shopify.ReadManyBasicDiscountCodesResult} */
    let result = {
      data: null,
      errors: [],
      meta: {},
    };

    if (
      !params?.title ||
      typeof params.title !== "string" ||
      params.title.trim() === ""
    ) {
      result.errors.push(
        createError({
          code: 400,
          fields: ["title"],
          message: "Invalid arguments",
          type: errors.ERR_INVALID_ARGS,
          data: params,
        })
      );
      return result;
    }

    const processedTitles = params.title
      .split(",")
      .filter((t) => t && typeof t === "string" && t.trim() !== "")
      .map((t) => t.trim());

    if (processedTitles.length === 0) {
      result.errors.push(
        createError({
          code: 400,
          fields: ["title"],
          message: "Invalid arguments",
          type: errors.ERR_INVALID_ARGS,
          data: params,
        })
      );
      return result;
    }

    let querystr = "";

    for (const title of processedTitles) {
      if (querystr !== "") {
        querystr += " OR ";
      }

      querystr += `title:${title}`;
    }

    querystr = `status:active AND ( ${querystr} )`;

    const client = createGraphqlClient();
    const { body } = await client.query({
      data: `query {
        codeDiscountNodes(
          first: 100
          query: "${querystr}"
        ) {
          edges {
            node {
              id
              metafield(key: "odooDiscount", namespace: "levents") {
                key
                type
                value
                id
                namespace
              }
              codeDiscount {
                ... on DiscountCodeBasic {
                  title
                  summary
                  customerSelection {
                    ... on DiscountCustomers {
                      customers {
                        email
                        phone
                      }
                    }
                    ... on DiscountCustomerAll {
                      allCustomers
                    }
                    ... on DiscountCustomerSegments {
                      segments {
                        id
                        name
                        query
                      }
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }`,
    });

    if (
      !Array.isArray(body?.data?.codeDiscountNodes?.edges) ||
      body.data.codeDiscountNodes.edges.length === 0
    ) {
      result.data = [];
      return result;
    }

    const discounts = body.data.codeDiscountNodes.edges.map(
      (edge) => edge.node
    );

    result.data = discounts;
    return result;
  } catch (error) {
    onsole.error(error);
    throw new Error("Read many basic discount code form Shopify faield");
  }
}

/**
 *
 * @param {Levents.Shopify.ReadOneCustomerParams} params
 * @returns {Promise<Levents.Shopify.ReadOneCustomerResult>}
 */
async function readOneCustomer(params) {
  try {
    /**@type {Levents.Shopify.ReadOneCustomerResult} */
    let result = {
      data: null,
      errors: [],
      meta: {},
    };
    let querystr = "";
    let nextBuildQueryStr = true;

    if (params?.not?.includes("id")) {
      querystr += `-id:${exportIdFromShopifyGlobalId(params.query.id)}`;
    } else if (params.query.id) {
      querystr += `id:${exportIdFromShopifyGlobalId(params.query.id)}`;
      nextBuildQueryStr = false;
    }

    if (nextBuildQueryStr) {
      let subQueryStr = "";

      if (params.query.email && params?.not?.includes("email")) {
        if (subQueryStr !== "") {
          subQueryStr += " AND ";
        }

        subQueryStr += `-email:${params.query.email}`;
      } else if (params.query.email) {
        if (subQueryStr !== "") {
          subQueryStr += " OR ";
        }

        subQueryStr += `email:${params.query.email}`;
      }

      if (params.query.phone) {
        const parsedPhone = parsePhoneNumber(params.query.phone, "VN");
        let phoneNumber = parsedPhone.number;
        let nationalNumber = parsedPhone.nationalNumber;

        if (params.query.phone && params?.not?.includes("phone")) {
          if (subQueryStr !== "") {
            subQueryStr += " AND ";
          }

          subQueryStr += `( -phone:${phoneNumber} AND -phone:0${nationalNumber} )`;
        } else if (params.query.phone) {
          if (subQueryStr !== "") {
            subQueryStr += " OR ";
          }

          subQueryStr += `( phone:${phoneNumber} OR phone:0${nationalNumber} )`;
        }
      }

      if (querystr !== "" && subQueryStr !== "") {
        querystr = `${querystr} AND ( ${subQueryStr} )`;
      } else if (querystr === "" && subQueryStr !== "") {
        querystr = subQueryStr;
      }
    }

    const client = createGraphqlClient();
    const { body } = await client.query({
      data: `query {
      customers(first: 5, query: "${querystr}") {
        edges {
          node {
            id
            displayName
            email
            firstName
            lastName
            note
            phone
            state
            tags
            verifiedEmail
            metafields(first: 100, namespace: "levents") {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }`,
    });

    if (
      !Array.isArray(body?.data?.customers?.edges) ||
      body.data.customers.edges.length !== 1
    ) {
      result.data = null;
      return result;
    }

    const customers = body.data.customers.edges.map((n) => n.node);
    const customer = customers.find(
      (c) =>
        (c.email && params.query.email && c.email === params.query.email) ||
        (c.phone &&
          params.query.phone &&
          helper.comparePhoneNumber(c.phone, params.query.phone))
    );
    customer.metafields = customer.metafields.edges.map((item) => item.node);
    result.data = customer;
    return result;
  } catch (error) {
    console.error(error);
    throw new Error("Read one customer form Shopify faield");
  }
}

/**
 *
 * @param {Levents.Shopify.CreateOneCustomerParams} params
 * @returns {Promise<Levents.Shopify.CreateOneCustomerResult>}
 */
async function createOneCustomer(params) {
  /**@type {Levents.Shopify.CreateOneCustomerResult} */
  let result = {
    data: null,
    errors: [],
    meta: {},
  };

  if (!params.email && !params.phone) {
    result.errors.push(
      createError({
        fields: ["email", "phone"],
        message: "Missing fields 'email' and 'phone'",
        type: ERR_INVALID_ARGS,
      })
    );
    result.meta.responseCode = responseCodes.invalidArgs;
    return result;
  }

  const input = {
    firstName: params.firstName,
    lastName: params.lastName,
    displayName: params.displayName,
    metafields: params.metafields,
  };

  if (params.tags) {
    input.tags = params.tags || "";
  }

  if (params.email) {
    input.email = params.email;
  }

  if (params.phone) {
    input.phone = parsePhoneNumber(params.phone, "VN").number;
  }

  const client = createGraphqlClient();
  const { body } = await client.query({
    data: {
      query: `mutation createCustomerMetafields($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            displayName
            email
            firstName
            lastName
            note
            phone
            state
            tags
            verifiedEmail
            metafields(first: 100, namespace: "levents") {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
          userErrors {
            message
            field
          }
        }
      }`,
      variables: {
        input,
      },
    },
  });

  if (
    Array.isArray(body?.data?.customerCreate?.userErrors) &&
    body.data.customerCreate.userErrors.length >= 1
  ) {
    console.error(body?.data?.customerCreate?.userErrors);
    result.data = null;
    result.errors.push(
      createError({
        message: "Create Shopify customer error",
      })
    );
    result.meta.responseCode = responseCodes.serverError;
    return result;
  }

  const customer = body?.data?.customerCreate.customer;
  customer.metafields = customer.metafields.edges.map((item) => item.node);
  result.data = customer;
  return result;
}

/**
 *
 * @param {Levents.Shopify.GenerateAccountActivationUrlParams} params
 * @returns {Promise<Levents.Shopify.GenerateAccountActivationUrlResult>}
 */
async function generateAccountActivationUrl(params) {
  /**@type {Levents.Shopify.GenerateAccountActivationUrlResult} */
  let result = {
    data: null,
    errors: [],
    meta: {},
  };

  const client = createGraphqlClient();
  const { body } = await client.query({
    data: {
      query: `mutation customerGenerateAccountActivationUrl($customerId: ID!) {
        customerGenerateAccountActivationUrl(customerId: $customerId) {
          accountActivationUrl
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        customerId: params.id,
      },
    },
  });

  if (
    Array.isArray(
      body?.data?.customerGenerateAccountActivationUrl?.userErrors
    ) &&
    body.data.customerGenerateAccountActivationUrl.userErrors.length >= 1
  ) {
    result.data = null;
    result.errors.push(
      createError({
        message: "Generate active url Shopify customer error",
      })
    );
    result.meta.responseCode = responseCodes.serverError;
    return result;
  }

  result.data = {
    accountActivationUrl:
      body.data.customerGenerateAccountActivationUrl.accountActivationUrl,
  };
  result.meta.responseCode = responseCodes.success;
  return result;
}

/**
 *
 * @param {Levents.Shopify.UpdateOneCustomerParams} params
 * @returns {Promise<Levents.Shopify.UpdateOneCustomerResult>}
 */
async function updateOneCustomer(params) {
  /**@type {Levents.Shopify.UpdateOneCustomerResult} */
  let result = {
    data: null,
    errors: [],
    meta: {},
  };

  const client = createGraphqlClient();
  const { body } = await client.query({
    data: {
      query: `mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            displayName
            email
            firstName
            lastName
            note
            phone
            state
            tags
            verifiedEmail
            metafields(first: 100, namespace: "levents") {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
          userErrors {
            message
            field
          }
        }
      }`,
      variables: {
        input: params,
      },
    },
  });

  if (
    Array.isArray(body?.data?.customerUpdate?.userErrors) &&
    body.data.customerUpdate.userErrors.length >= 1
  ) {
    console.log(body?.data?.customerUpdate?.userErrors);
    result.data = null;
    result.errors.push({
      message: "Update Shopify customer error",
    });
    result.meta.responseCode = responseCodes.serverError;
    return result;
  }

  const customer = body?.data?.customerUpdate.customer;
  customer.metafields = customer.metafields.edges.map((item) => item.node);
  result.data = customer;
  result.meta.responseCode = responseCodes.success;
  return result;
}

/**
 *
 * @param {Levents.Shopify.DeleteOneCustomerParams} params
 * @returns {Promise<Levents.Shopify.DeleteOneCustomerResult>}
 */
async function deleteOneCustomer(params) {
  /**@type {Levents.Shopify.DeleteOneCustomerResult} */
  let result = {
    data: null,
    errors: [],
    meta: {},
  };
  const client = createGraphqlClient();
  const { body } = await client.query({
    data: {
      query: `mutation customerDelete($id: ID!) {
        customerDelete(input: {id: $id}) {
          shop {
            id
          }
          userErrors {
            field
            message
          }
          deletedCustomerId
        }
      }`,
      variables: {
        id: params.id,
      },
    },
  });

  if (
    Array.isArray(body?.data?.customerDelete?.userErrors) &&
    body.data.customerDelete.userErrors.length >= 1
  ) {
    console.log(body?.data?.customerDelete?.userErrors);
    result.data = null;
    result.errors.push({
      message: "delete Shopify customer error",
    });
    result.meta.responseCode = responseCodes.serverError;
    return result;
  }

  const id = body?.data?.customerDelete.deletedCustomerId;
  result.data = { id };
  result.meta.responseCode = responseCodes.success;
  return result;
}

/**
 *
 * @param {Levents.Shopify.DeleteOneMetafieldParams} params
 * @returns {Promise<Levents.Shopify.DeleteOneMetafieldResult>}
 */
async function deleteOneMetafield(params) {
  /**@type {Levents.Shopify.DeleteOneMetafieldResult} */
  let result = {
    data: null,
    errors: [],
    meta: {},
  };
  const client = createGraphqlClient();
  const { body } = await client.query({
    data: {
      query: `mutation metafieldDelete($input: MetafieldDeleteInput!) {
        metafieldDelete(input: $input) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        input: {
          id: params.id,
        },
      },
    },
  });

  if (
    Array.isArray(body?.data?.metafieldDelete?.userErrors) &&
    body.data.metafieldDelete.userErrors.length >= 1
  ) {
    console.log(body?.data?.metafieldDelete?.userErrors);
    result.data = null;
    result.errors.push({
      message: "Delete Shopify metafield error",
    });
    result.meta.responseCode = responseCodes.serverError;
    return result;
  }

  const deletedId = body?.data?.metafieldDelete.deletedId;
  result.data = { deletedId };
  result.meta.responseCode = responseCodes.success;
  return result;
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

/**
 *
 * @param {string} gid
 */
function exportIdFromShopifyGlobalId(gid) {
  return gid.match(/[^/]+$/)[0];
}

const customerMetafieldsTemplate = [
  {
    key: "currentPoints",
    namespace: "levents",
    type: "number_integer",
    value: "100",
  },
  {
    key: "currentRewardPointsLVS",
    namespace: "levents",
    type: "number_integer",
    value: "200",
  },
  {
    key: "fullName",
    namespace: "levents",
    type: "single_line_text_field",
    value: "Nguuyen Van An",
  },
  {
    key: "dateOfBirth",
    namespace: "levents",
    type: "single_line_text_field",
    value: "1995-05-05T08:17:37.154Z",
  },
  {
    key: "gender",
    namespace: "levents",
    type: "single_line_text_field",
    value: "Nam",
  },
  {
    key: "odooCustomerId",
    namespace: "levents",
    type: "single_line_text_field",
    value: "432",
  },
  {
    key: "registeredDate",
    namespace: "levents",
    type: "single_line_text_field",
    value: "1995-05-05T08:17:37.154Z",
  },
];

module.exports = {
  readOneCustomer,
  createOneCustomer,
  deleteOneCustomer,
  deleteOneMetafield,
  updateOneCustomer,
  generateAccountActivationUrl,
  convertMetafieldsToObject,
  exportMetafieldValue,
  exportMetafieldId,
  exportIdFromShopifyGlobalId,
  readManyBasicDiscountCodes,

  customerState,
  customerMetafieldsTemplate,
};
