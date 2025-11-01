"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genId = genId;
const crypto_1 = __importDefault(require("crypto"));
function randomString(length = 12) {
    const bytes = crypto_1.default.randomBytes(length);
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let out = '';
    for (let i = 0; i < length; i++)
        out += chars[bytes[i] % chars.length];
    return out;
}
function genId(prefix = '') {
    return prefix + randomString(12);
}
