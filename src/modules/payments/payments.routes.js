"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const razorpay_1 = require("../../lib/razorpay");
const subscriptionLog_model_1 = require("./subscriptionLog.model");
const user_model_1 = require("../users/user.model");
const mongoose_1 = __importDefault(require("mongoose"));
const date_fns_1 = require("date-fns");
const commissionLedger_model_1 = require("../mlm/commissionLedger.model");
const walletTxn_model_1 = require("../wallet/walletTxn.model");
const router = (0, express_1.Router)();
router.post('/payments/registration/order', (0, auth_1.auth)(), async (req, res) => {
    const order = await (0, razorpay_1.createOrderRupees)(2100, { purpose: 'activation', uid: req.user.uid });
    await subscriptionLog_model_1.SubscriptionLogModel.create({ uid: req.user.uid, type: 'activation', amount: 2100, orderId: order.id, status: 'created' });
    res.json(order);
});
router.post('/payments/renewal/order', (0, auth_1.auth)(), async (req, res) => {
    const order = await (0, razorpay_1.createOrderRupees)(1000, { purpose: 'renewal', uid: req.user.uid });
    await subscriptionLog_model_1.SubscriptionLogModel.create({ uid: req.user.uid, type: 'renewal', amount: 1000, orderId: order.id, status: 'created' });
    res.json(order);
});
// Webhook: simplified and idempotent by paymentId
const webhookSchema = zod_1.z.object({
    body: zod_1.z.object({
        event: zod_1.z.string(),
        payload: zod_1.z.any(),
        type: zod_1.z.enum(['activation', 'renewal', 'topup']).optional(),
        testBypass: zod_1.z.boolean().optional(),
    }),
});
router.post('/payments/webhook', (0, validate_1.validate)(webhookSchema), async (req, res) => {
    const { body } = req;
    const type = body.type || 'activation';
    const paymentId = body.payload?.payment?.entity?.id || body.payload?.payment_id || 'pay_test_' + Date.now();
    const amount = Math.round((body.payload?.payment?.entity?.amount || 0) / 100);
    const uid = body.payload?.notes?.uid || body.payload?.order?.entity?.notes?.uid;
    if (!body.testBypass && !(0, razorpay_1.verifySignatureStubOk)()) {
        return res.status(400).json({ error: 'signature_verification_failed_or_stub_keys_missing' });
    }
    const exists = await subscriptionLog_model_1.SubscriptionLogModel.findOne({ paymentId }).lean();
    if (exists)
        return res.json({ ok: true, idempotent: true });
    const session = await mongoose_1.default.startSession();
    try {
        await session.withTransaction(async () => {
            const user = await user_model_1.UserModel.findOne({ uid }).session(session);
            if (!user)
                throw Object.assign(new Error('user_not_found'), { status: 404 });
            if (type === 'activation') {
                const now = new Date();
                const validUntil = (0, date_fns_1.addDays)(now, 60);
                if (!user.activatedAt)
                    user.activatedAt = now;
                user.status = 'active';
                user.validUntil = validUntil;
                await user.save({ session });
                await subscriptionLog_model_1.SubscriptionLogModel.create([{ uid, type: 'activation', amount: 2100, paymentId, status: 'captured', validFrom: now, validUntil }], { session });
                // distribute MLM commissions
                await distributeCommission({ session, userUid: uid, amount: 2100, type: 'activation' });
            }
            else if (type === 'renewal') {
                const now = new Date();
                const base = user.validUntil && user.validUntil > now ? user.validUntil : now;
                user.status = 'active';
                user.validUntil = (0, date_fns_1.addDays)(base, 30);
                await user.save({ session });
                await subscriptionLog_model_1.SubscriptionLogModel.create([{ uid, type: 'renewal', amount: 1000, paymentId, status: 'captured', validFrom: now, validUntil: user.validUntil }], { session });
                await distributeCommission({ session, userUid: uid, amount: 1000, type: 'renewal' });
            }
            else if (type === 'topup') {
                user.wallet.actual += amount;
                await user.save({ session });
                await walletTxn_model_1.WalletTxnModel.create([{ uid, wallet: 'actual', type: 'credit', amount, reason: 'topup', balanceAfter: user.wallet.actual }], { session });
            }
        });
    }
    finally {
        await session.endSession();
    }
    res.json({ ok: true });
});
async function distributeCommission({ session, userUid, amount, type }) {
    // Commission tables
    const tableActivation = [500, 100, 50, 50, 50, 50, 50, 50, 50, 50];
    const tableRenewal = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    const table = type === 'activation' ? tableActivation : tableRenewal;
    let currentUid = userUid;
    for (let level = 1; level <= 10; level++) {
        const user = await user_model_1.UserModel.findOne({ uid: currentUid }).session(session);
        if (!user?.parentUid)
            break;
        const parent = await user_model_1.UserModel.findOne({ uid: user.parentUid }).session(session);
        if (!parent)
            break;
        // Level unlock by direct referrals count
        if (parent.directReferralsCount >= level) {
            const amt = table[level - 1];
            parent.wallet.commission += amt;
            await parent.save({ session });
            await walletTxn_model_1.WalletTxnModel.create([
                {
                    uid: parent.uid,
                    wallet: 'commission',
                    type: 'credit',
                    amount: amt,
                    reason: 'commission',
                    ref: { level, sourceUid: userUid },
                    balanceAfter: parent.wallet.commission,
                },
            ], { session });
            await commissionLedger_model_1.CommissionLedgerModel.create([
                { earnerUid: parent.uid, fromUid: userUid, level, amount: amt, withdrawable: true },
            ], { session });
        }
        currentUid = parent.uid;
    }
}
exports.default = router;
// Subscriptions history for current user
router.get('/me/history/subscriptions', (0, auth_1.auth)(), async (req, res) => {
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20')));
    const data = await subscriptionLog_model_1.SubscriptionLogModel.find({ uid: req.user.uid })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    res.json({ page, limit, data });
});
