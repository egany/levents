#!/usr/bin/env node

/**
 * Module dependencies.
 */
require("dotenv").config();
require("./core/load-app-settings")
const mongoose = require("mongoose");
const debug = require("debug")("levents:server");
const http = require("http");
const { helper } = require("./core");
const app = require("./app");

/**
 * Get port from environment and store in Express.
 */

app.set("port", helper.normalizePort(process.env.PORT || "3000"));

/**
 * Create HTTP server.
 */

const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

mongoose
  .connect(`${process.env.MONGO_CONNECTION_STRING}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(helper.normalizePort(process.env.PORT || "3000"));
  })
  .catch((err) => console.log(err));

server.on("error", onError);
server.on("listening", onListening);

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }
  let port = helper.normalizePort(process.env.PORT || "3000");
  let bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  let addr = server.address();
  let bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  console.log("Server running on " + bind);
}
