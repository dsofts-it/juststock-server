"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushNotify = pushNotify;
const logger_1 = require("../config/logger");
async function pushNotify(uid, title, body, meta = {}) {
    logger_1.logger.info({ uid, title, body, meta }, 'PUSH STUB');
}
