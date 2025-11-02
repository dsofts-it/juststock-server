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
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const user_model_1 = require("./user.model");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    body: zod_1.z.object({ referralCode: zod_1.z.string().optional() }),
});
router.post('/register', (0, auth_1.auth)(), (0, validate_1.validate)(registerSchema), async (req, res) => {
    const user = await user_model_1.UserModel.findOne({ uid: req.user.uid }).exec();
    if (!user)
        return res.status(404).json({ error: 'user_not_found' });
    if (user.parentUid)
        return res.json({ ok: true });
    const { referralCode } = req.body;
    if (referralCode) {
        const parent = await user_model_1.UserModel.findOne({ referralCode }).exec();
        if (!parent)
            return res.status(400).json({ error: 'invalid_referral' });
        user.parentUid = parent.uid;
        await user.save();
        parent.directReferralsCount += 1;
        await parent.save();
    }
    res.json({ ok: true });
});
router.get('/me', (0, auth_1.auth)(), async (req, res) => {
    const user = (await user_model_1.UserModel.findOne({ uid: req.user.uid }).lean());
    if (!user)
        return res.status(404).json({ error: 'user_not_found' });
    const now = new Date();
    const daysLeft = user.validUntil ? Math.max(0, Math.ceil((user.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
    res.json({
        uid: user.uid,
        email: user.email,
        role: user.role,
        status: user.status,
        validUntil: user.validUntil,
        daysLeft,
        includedCallsRemaining: user.includedCallsRemaining,
    });
});

// Update profile: name and phone
const updateMeSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        phone: zod_1.z.string().min(5).optional(),
    }).refine((d) => typeof d.name !== 'undefined' || typeof d.phone !== 'undefined', {
        message: 'no_changes',
        path: ['body'],
    }),
});
router.patch('/me', (0, auth_1.auth)(), (0, validate_1.validate)(updateMeSchema), async (req, res) => {
    const user = await user_model_1.UserModel.findOne({ uid: req.user.uid }).exec();
    if (!user)
        return res.status(404).json({ error: 'user_not_found' });
    if (typeof req.body.name !== 'undefined') user.name = req.body.name;
    if (typeof req.body.phone !== 'undefined') user.phone = req.body.phone;
    await user.save();
    return res.json({ ok: true });
});
router.get('/me/tree', (0, auth_1.auth)(), async (req, res) => {
    // Simplified: return direct referrals only, with pagination
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;
    const children = await user_model_1.UserModel.find({ parentUid: req.user.uid })
        .select('uid email role status directReferralsCount')
        .skip(skip)
        .limit(limit)
        .lean();
    res.json({ page, limit, data: children });
});
router.get('/me/wallet', (0, auth_1.auth)(), async (req, res) => {
    const user = (await user_model_1.UserModel.findOne({ uid: req.user.uid }).lean());
    if (!user)
        return res.status(404).json({ error: 'user_not_found' });
    const isUnlimited = user.role === 'special' || user.role === 'demo';
    if (isUnlimited) {
        return res.json({ commission: 0, actual: 0, commissionUnlimited: true, actualUnlimited: true });
    }
    res.json({ commission: user.wallet.commission, actual: user.wallet.actual, commissionUnlimited: false, actualUnlimited: false });
});
// Commissions history for current user
router.get('/me/history/commissions', (0, auth_1.auth)(), async (req, res) => {
    const { CommissionLedgerModel } = await Promise.resolve().then(() => __importStar(require('../mlm/commissionLedger.model')));
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20')));
    const data = await CommissionLedgerModel.find({ earnerUid: req.user.uid })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    res.json({ page, limit, data });
});
exports.default = router;
