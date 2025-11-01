"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMailer = getMailer;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
let transporter = null;
function getMailer() {
    if (transporter)
        return transporter;
    if (!env_1.env.SMTP_HOST || !env_1.env.SMTP_USER || !env_1.env.SMTP_PASS) {
        logger_1.logger.warn('SMTP not configured; using console mailer');
        const stub = {
            sendMail: async (opts) => {
                logger_1.logger.info({ mail: opts }, 'MAIL STUB');
                return { messageId: 'stub' };
            },
        };
        transporter = stub;
        return transporter;
    }
    transporter = nodemailer_1.default.createTransport({
        host: env_1.env.SMTP_HOST,
        port: env_1.env.SMTP_PORT,
        secure: env_1.env.SMTP_PORT === 465,
        auth: { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASS },
    });
    return transporter;
}
