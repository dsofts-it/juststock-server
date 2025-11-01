"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const razorpay_1 = require("../../lib/razorpay");
const user_model_1 = require("../users/user.model");
const walletTxn_model_1 = require("./walletTxn.model");
const payoutRequest_model_1 = require("../payouts/payoutRequest.model");
const router = (0, express_1.Router)();
const topupSchema = zod_1.z.object({ body: zod_1.z.object({ amount: zod_1.z.number().int().min(1) }) });
router.post('/wallet/topup/order', (0, auth_1.auth)(), (0, validate_1.validate)(topupSchema), async (req, res) => {
    const { amount } = req.body;
    const order = await (0, razorpay_1.createOrderRupees)(amount, { purpose: 'topup', uid: req.user.uid });
    res.json(order);
});

const withdrawSchema = zod_1.z.object({ body: zod_1.z.object({ amount: zod_1.z.number().int().min(100).max(1000) }) });
router.post('/me/withdraw', (0, auth_1.auth)(), (0, validate_1.validate)(withdrawSchema), async (req, res) => {
    const { amount } = req.body;
    const user = await user_model_1.UserModel.findOne({ uid: req.user.uid }).exec();
    if (!user)
        return res.status(404).json({ error: 'user_not_found' });
    if (user.role === 'special' || user.role === 'demo')
        return res.status(400).json({ error: 'not_allowed_for_role' });
    if (user.status !== 'active')
        return res.status(400).json({ error: 'inactive_cannot_withdraw' });
    if (user.wallet.commission < amount)
        return res.status(400).json({ error: 'insufficient_balance' });
    const pr = await payoutRequest_model_1.PayoutRequestModel.create({
        uid: user.uid,
        amount,
        status: 'pending',
        requestedAt: new Date(),
    });
    // Note: CommissionWallet is NOT debited here; it remains as dummy balance
    // until Admin marks this payout as 'paid'.
    res.json({ ok: true, payoutRequestId: pr._id });
});
exports.default = router;

// History: wallet transactions
router.get('/me/history/wallet', (0, auth_1.auth)(), async (req, res) => {
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20')));
    const data = await walletTxn_model_1.WalletTxnModel.find({ uid: req.user.uid })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    res.json({ page, limit, data });
});
