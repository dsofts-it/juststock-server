"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    phone: { type: String },
    passwordHash: { type: String },
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'user', 'special', 'demo'],
        default: 'user',
        index: true,
    },
    referralCode: { type: String, required: true, unique: true, index: true },
    parentUid: { type: String, index: true },
    directReferralsCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive', 'deactivated'], default: 'inactive', index: true },
    activatedAt: { type: Date },
    validUntil: { type: Date, index: true },
    isTop6Exempt: { type: Boolean, default: false },
    wallet: {
        commission: { type: Number, default: 0 },
        actual: { type: Number, default: 0 },
    },
    includedCallsRemaining: { type: Number, default: 17 },
    marketingRootUid: { type: String },
    createdBy: { type: String },
}, { timestamps: true });
exports.UserModel = mongoose_1.default.models.User || mongoose_1.default.model('User', UserSchema);
