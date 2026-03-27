/*
 * Firebase Functions entrypoint.
 *
 * NOTE: This project lives in a Windows folder name containing '&'.
 * Some CLI subprocesses can break when executing npm bin shims from such paths.
 * We keep this file tiny and delegate all logic to ./src/index.js.
 */

module.exports = require('./src/index.js');
