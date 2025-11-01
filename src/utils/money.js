"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUPEE = void 0;
exports.toPaise = toPaise;
exports.fromPaise = fromPaise;
exports.RUPEE = 1; // integer units are rupees
function toPaise(rupees) {
    return Math.round(rupees * 100);
}
function fromPaise(paise) {
    return Math.round(paise / 100);
}
