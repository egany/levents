const SERVER_ERROR = "SERVER_ERROR";
const ERR_INVALID_ARGS = "ERR_INVALID_ARGS";
const ERR_CONFLICT = "ERR_CONFLICT";
const ERR_NOT_FOUND = "ERR_NOT_FOUND";
const ERR_FORBIDDEN = "ERR_FORBIDDEN";

/**
 *
 * @param {Levents.Errors.AppErrorParams} params
 * @returns {Levents.Errors.AppError}
 */
function createError(params) {
  return {
    ...{
      code: 500,
      type: "SERVER_ERROR",
      message: "Server error",
      viMessage: "Lỗi từ máy chủ",
      fields: [],
      errors: [],
      data: null,
      __name__: "AppError",
    },
    ...params,
  };
}

/**
 *
 * @param {Levents.Errors.IsInstanceParams} params
 * @returns {Levents.Errors.IsInstanceResult}
 */
function isInstance(params) {
  return params && typeof params === "object" && params.__name__ === "AppError";
}

module.exports = {
  createError,
  isInstance,

  SERVER_ERROR,
  ERR_INVALID_ARGS,
  ERR_CONFLICT,
  ERR_NOT_FOUND,
  ERR_FORBIDDEN,
};
