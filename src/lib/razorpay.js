"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrderRupees = createOrderRupees;
exports.verifySignatureStubOk = verifySignatureStubOk;
const razorpay_1 = __importDefault(require("razorpay"));
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const id_1 = require("../utils/id");
const money_1 = require("../utils/money");
let client = null;
function getClient() {
    if (!env_1.env.RAZORPAY_KEY_ID || !env_1.env.RAZORPAY_KEY_SECRET)
        return null;
    if (!client) {
        client = new razorpay_1.default({ key_id: env_1.env.RAZORPAY_KEY_ID, key_secret: env_1.env.RAZORPAY_KEY_SECRET });
    }
    return client;
}
async function createOrderRupees(amountRupees, notes = {}) {
    const c = getClient();
    if (!c) {
        const fake = {
            id: 'order_' + (0, id_1.genId)(),
            amount: (0, money_1.toPaise)(amountRupees),
            currency: 'INR',
            status: 'created',
            notes,
        };
        logger_1.logger.warn({ order: fake }, 'RAZORPAY STUB ORDER');
        return fake;
    }
    return c.orders.create({ amount: (0, money_1.toPaise)(amountRupees), currency: 'INR', notes });
}
function verifySignatureStubOk() {
    // In real deploy, verify x-razorpay-signature using key secret
    return !(!env_1.env.RAZORPAY_KEY_ID || !env_1.env.RAZORPAY_KEY_SECRET);
}
