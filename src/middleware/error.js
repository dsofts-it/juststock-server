"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const logger_1 = require("../config/logger");
function errorHandler(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({ error: 'validation_error', details: err.flatten() });
    }
    const status = err?.status || 500;
    const message = err?.message || 'Internal Server Error';
    if (status >= 500)
        logger_1.logger.error({ err }, 'Unhandled error');
    res.status(status).json({ error: message });
}
