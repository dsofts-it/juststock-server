"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const user_model_1 = require("../users/user.model");
const commissionLedger_model_1 = require("../mlm/commissionLedger.model");
const payoutRequest_model_1 = require("../payouts/payoutRequest.model");
const walletTxn_model_1 = require("../wallet/walletTxn.model");
const id_1 = require("../../utils/id");
const router = (0, express_1.Router)();
router.get('/admin/dashboard', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin', 'admin']), async (_req, res) => {
    const [totalUsers, activeUsers, inactiveUsers, deactivatedUsers] = await Promise.all([
        user_model_1.UserModel.countDocuments({}),
        user_model_1.UserModel.countDocuments({ status: 'active' }),
        user_model_1.UserModel.countDocuments({ status: 'inactive' }),
        user_model_1.UserModel.countDocuments({ status: 'deactivated' }),
    ]);
    const commissions = await commissionLedger_model_1.CommissionLedgerModel.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({
        totals: { users: totalUsers, active: activeUsers, inactive: inactiveUsers, deactivated: deactivatedUsers },
        commissions: commissions[0]?.total || 0,
    });
});
router.get('/admin/users', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin', 'admin']), async (req, res) => {
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20')));
    const role = req.query.role;
    const q = {};
    if (role)
        q.role = role;
    const data = await user_model_1.UserModel.find(q)
        .select('uid email role status directReferralsCount wallet validUntil')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    res.json({ page, limit, data });
});
router.patch('/admin/users/:uid/status', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin']), async (req, res) => {
    const { uid } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive', 'deactivated'].includes(status))
        return res.status(400).json({ error: 'invalid_status' });
    await user_model_1.UserModel.updateOne({ uid }, { $set: { status } });
    res.json({ ok: true });
});
router.get('/admin/commissions', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin', 'admin']), async (req, res) => {
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20')));
    const data = await commissionLedger_model_1.CommissionLedgerModel.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.json({ page, limit, data });
});
router.get('/admin/payouts', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin', 'admin']), async (req, res) => {
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20')));
    const data = await payoutRequest_model_1.PayoutRequestModel.find({}).sort({ requestedAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.json({ page, limit, data });
});
router.patch('/admin/payouts/:id', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin']), async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    if (!['approved', 'rejected', 'paid'].includes(status))
        return res.status(400).json({ error: 'invalid_status' });
    const request = await payoutRequest_model_1.PayoutRequestModel.findById(id);
    if (!request)
        return res.status(404).json({ error: 'not_found' });
    if (status === 'paid') {
        // Idempotency: check if we already created a withdrawal txn for this payout
        const existing = await walletTxn_model_1.WalletTxnModel.findOne({ uid: request.uid, reason: 'withdrawal', 'ref.payoutId': String(request._id) }).lean();
        if (!existing) {
            const user = await user_model_1.UserModel.findOne({ uid: request.uid }).exec();
            if (!user)
                return res.status(404).json({ error: 'user_not_found' });
            const before = user.wallet.commission || 0;
            const debit = Math.min(before, request.amount);
            user.wallet.commission = before - debit;
            await user.save();
            await walletTxn_model_1.WalletTxnModel.create({
                uid: user.uid,
                wallet: 'commission',
                type: 'debit',
                amount: debit,
                reason: 'withdrawal',
                ref: { payoutId: String(request._id) },
                balanceAfter: user.wallet.commission,
            });
        }
        request.status = 'paid';
        request.notes = notes;
        request.processedAt = new Date();
        await request.save();
        return res.json({ ok: true, status: 'paid' });
    }
    // approved or rejected: just update status/notes
    await payoutRequest_model_1.PayoutRequestModel.updateOne({ _id: id }, { $set: { status, notes, processedAt: new Date() } });
    res.json({ ok: true, status });
});
// Seed demo users (admin only)
router.post('/admin/seed/demo-users', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin']), async (_req, res) => {
    const promises = [];
    for (let i = 1; i <= 30; i++) {
        const email = `demo${i}@example.com`;
        promises.push(user_model_1.UserModel.findOneAndUpdate({ email }, {
            $setOnInsert: {
                uid: (0, id_1.genId)('u_'),
                email,
                role: 'demo',
                referralCode: (0, id_1.genId)('ref_'),
                status: 'active',
                wallet: { commission: 0, actual: 100000 },
            },
        }, { upsert: true }));
    }
    await Promise.all(promises);
    res.json({ ok: true });
});
exports.default = router;
// Create Special or Demo users (SuperAdmin only)
router.post('/admin/users/special', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin']), async (req, res) => {
    const { name, email, mobile, password } = req.body || {};
    if (!email || !name)
        return res.status(400).json({ error: 'missing_fields' });
    const existing = await user_model_1.UserModel.findOne({ email: String(email).toLowerCase() }).lean();
    if (existing)
        return res.status(409).json({ error: 'email_exists' });
    const { default: argon2 } = await Promise.resolve().then(() => require('argon2'));
    const { genId } = await Promise.resolve().then(() => require('../../utils/id'));
    const passwordHash = password ? await argon2.hash(password) : undefined;
    const u = await user_model_1.UserModel.create({
        uid: genId('u_'),
        name,
        email: String(email).toLowerCase(),
        phone: mobile,
        passwordHash,
        role: 'special',
        referralCode: genId('ref_'),
        wallet: { commission: 0, actual: 0 },
        includedCallsRemaining: 17,
        directReferralsCount: 0,
        status: 'active',
    });
    res.status(201).json({ uid: u.uid });
});

router.post('/admin/users/demo', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin']), async (req, res) => {
    const { name, email, mobile, password } = req.body || {};
    if (!email || !name)
        return res.status(400).json({ error: 'missing_fields' });
    const existing = await user_model_1.UserModel.findOne({ email: String(email).toLowerCase() }).lean();
    if (existing)
        return res.status(409).json({ error: 'email_exists' });
    const { default: argon2 } = await Promise.resolve().then(() => require('argon2'));
    const { genId } = await Promise.resolve().then(() => require('../../utils/id'));
    const passwordHash = password ? await argon2.hash(password) : undefined;
    const u = await user_model_1.UserModel.create({
        uid: genId('u_'),
        name,
        email: String(email).toLowerCase(),
        phone: mobile,
        passwordHash,
        role: 'demo',
        referralCode: genId('ref_'),
        wallet: { commission: 0, actual: 0 },
        includedCallsRemaining: 17,
        directReferralsCount: 0,
        status: 'active',
    });
    res.status(201).json({ uid: u.uid });
});
