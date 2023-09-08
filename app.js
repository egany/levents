const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const logger = require("morgan");

const accountRouter = require("./routes/account");
const locationRouter = require("./routes/location");
const judgeMeRouter = require("./routes/judge-me");
const toolsRouter = require("./routes/tools");
const discountRouter = require("./routes/discount");
const odooRouter = require("./routes/odoo");

const app = express();

let whitelist = process.env.CORS_ALLOWED_ORIGIN
  ? process.env.CORS_ALLOWED_ORIGIN.split(",")
      .filter(
        (o) =>
          o !== undefined &&
          o !== null &&
          typeof o === "string" &&
          o.trim() !== ""
      )
      .map((o) => o.trim())
  : ["*"];
let corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/accounts", accountRouter);
app.use("/locations", locationRouter);
app.use("/judge-me", judgeMeRouter);
app.use("/discounts", discountRouter);
app.use("/odoo", odooRouter);

if (process.env.API_TOOLS_ENABLE === "true") {
  app.use("/tools", toolsRouter);
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
