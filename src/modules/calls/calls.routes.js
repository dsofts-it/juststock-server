"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const advisoryCall_model_1 = require("./advisoryCall.model");
const callEntitlement_model_1 = require("./callEntitlement.model");
const user_model_1 = require("../users/user.model");
const walletTxn_model_1 = require("../wallet/walletTxn.model");
const id_1 = require("../../utils/id");
const razorpay_1 = require("../../lib/razorpay");
const router = (0, express_1.Router)();
// Admin: create call
const createCallSchema = zod_1.z.object({
    body: zod_1.z.object({
        category: zod_1.z.enum(['NIFTY', 'BANKNIFTY', 'SENSEX', 'COMMODITY', 'OTHERS']),
        title: zod_1.z.string().min(1),
        body: zod_1.z.string().min(1),
        price: zod_1.z.number().int().min(0).optional().default(116),
    }),
});
router.post('/admin/calls', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin']), (0, validate_1.validate)(createCallSchema), async (req, res) => {
    const { category, title, body, price } = req.body;
    const call = await advisoryCall_model_1.AdvisoryCallModel.create({
        callId: (0, id_1.genId)('call_'),
        category,
        title,
        titleUpper: title.toUpperCase(),
        body,
        price: price ?? 116,
        postedBy: req.user.uid,
        postedAt: new Date(),
    });
    res.json(call);
});
// Admin list calls
router.get('/admin/calls', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin', 'admin']), async (req, res) => {
    const category = req.query.category;
    const q = {};
    if (category)
        q.category = category;
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20')));
    const data = await advisoryCall_model_1.AdvisoryCallModel.find(q).sort({ postedAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.json({ page, limit, data });
});
// User browse calls with unlocked flag
router.get('/calls', (0, auth_1.auth)(), async (req, res) => {
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20')));
    const category = req.query.category;
    const q = {};
    if (category)
        q.category = category;
    const calls = await advisoryCall_model_1.AdvisoryCallModel.find(q).sort({ postedAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    const ids = calls.map((c) => c.callId);
    const ent = await callEntitlement_model_1.CallEntitlementModel.find({ uid: req.user.uid, callId: { $in: ids } })
        .select('callId')
        .lean();
    const entSet = new Set(ent.map((e) => e.callId));
    const data = calls.map((c) => ({
        callId: c.callId,
        category: c.category,
        title: c.title,
        postedAt: c.postedAt,
        price: c.price,
        unlocked: entSet.has(c.callId),
        ...(entSet.has(c.callId) ? { body: c.body } : {}),
    }));
    res.json({ page, limit, data });
});
// Unlock a call
router.post('/calls/:callId/unlock', (0, auth_1.auth)(), async (req, res) => {
    const { callId } = req.params;
    const call = (await advisoryCall_model_1.AdvisoryCallModel.findOne({ callId }).lean());
    if (!call)
        return res.status(404).json({ error: 'call_not_found' });
    const existing = await callEntitlement_model_1.CallEntitlementModel.findOne({ uid: req.user.uid, callId }).lean();
    if (existing)
        return res.json({ ok: true, alreadyUnlocked: true });
    const user = await user_model_1.UserModel.findOne({ uid: req.user.uid }).exec();
    if (!user)
        return res.status(404).json({ error: 'user_not_found' });
    if (user.includedCallsRemaining > 0 || user.role === 'special' || user.role === 'demo') {
        if (user.role !== 'special' && user.role !== 'demo')
            user.includedCallsRemaining -= 1;
        await user.save();
        await callEntitlement_model_1.CallEntitlementModel.create({ uid: user.uid, callId, method: 'included', amount: 0 });
        return res.json({ ok: true, method: 'included' });
    }
    if (user.wallet.actual >= call.price) {
        user.wallet.actual -= call.price;
        await user.save();
        await callEntitlement_model_1.CallEntitlementModel.create({ uid: user.uid, callId, method: 'wallet', amount: call.price });
        await walletTxn_model_1.WalletTxnModel.create({
            uid: user.uid,
            wallet: 'actual',
            type: 'debit',
            amount: call.price,
            reason: 'call_unlock',
            ref: { callId },
            balanceAfter: user.wallet.actual,
        });
        return res.json({ ok: true, method: 'wallet' });
    }
    // insufficient => return 402 with topup order
    const deficit = call.price - user.wallet.actual;
    const order = await (0, razorpay_1.createOrderRupees)(deficit, { purpose: 'call_unlock', callId, uid: user.uid });
    return res.status(402).json({ error: 'insufficient_funds', order });
});
// View details only if entitlement
router.get('/calls/:callId', (0, auth_1.auth)(), async (req, res) => {
    const { callId } = req.params;
    const ent = await callEntitlement_model_1.CallEntitlementModel.findOne({ uid: req.user.uid, callId }).lean();
    if (!ent)
        return res.status(403).json({ error: 'locked' });
    const call = await advisoryCall_model_1.AdvisoryCallModel.findOne({ callId }).lean();
    if (!call)
        return res.status(404).json({ error: 'call_not_found' });
    res.json(call);
});
// History of unlocked calls
router.get('/history/calls', (0, auth_1.auth)(), async (req, res) => {
    const page = parseInt(String(req.query.page || '1'));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20')));
    const data = await callEntitlement_model_1.CallEntitlementModel.find({ uid: req.user.uid })
        .sort({ unlockedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    res.json({ page, limit, data });
});
exports.default = router;

// Latest one message per major category
router.get('/calls/latest5', (0, auth_1.auth)(), async (req, res) => {
    const categories = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'COMMODITY', 'OTHERS'];
    const latest = await Promise.all(
        categories.map((cat) => advisoryCall_model_1.AdvisoryCallModel.findOne({ category: cat })
            .sort({ postedAt: -1 })
            .lean())
    );
    const calls = latest.filter(Boolean);
    const ids = calls.map((c) => c.callId);
    const ents = await callEntitlement_model_1.CallEntitlementModel.find({ uid: req.user.uid, callId: { $in: ids } })
        .select('callId')
        .lean();
    const entSet = new Set(ents.map((e) => e.callId));
    const result = {};
    categories.forEach((cat, i) => {
        const c = latest[i];
        if (!c) {
            result[cat] = null;
        }
        else {
            const unlocked = entSet.has(c.callId);
            result[cat] = {
                callId: c.callId,
                category: c.category,
                title: c.title,
                postedAt: c.postedAt,
                price: c.price,
                unlocked,
                ...(unlocked ? { body: c.body } : {}),
            };
        }
    });
    res.json(result);
});

// Get only the latest message for a category, marking if unlocked.
const categoryParamSchema = zod_1.z.object({ params: zod_1.z.object({ category: zod_1.z.enum(['NIFTY', 'BANKNIFTY', 'SENSEX', 'COMMODITY', 'OTHERS']) }) });
router.get('/messages/latest/:category', (0, auth_1.auth)(), (0, validate_1.validate)(categoryParamSchema), async (req, res) => {
    const { category } = req.params;
    const call = await advisoryCall_model_1.AdvisoryCallModel.findOne({ category }).sort({ postedAt: -1 }).lean();
    if (!call)
        return res.json({ category, call: null, unlocked: false });
    const ent = await callEntitlement_model_1.CallEntitlementModel.findOne({ uid: req.user.uid, callId: call.callId }).lean();
    const unlocked = Boolean(ent);
    const result = {
        callId: call.callId,
        category: call.category,
        title: call.title,
        postedAt: call.postedAt,
        price: call.price,
        unlocked,
        ...(unlocked ? { body: call.body } : {}),
    };
    return res.json({ category, call: result, unlocked });
});

// Unlock the latest message in a category by debiting wallet (no freebies here)
router.post('/messages/latest/:category/unlock', (0, auth_1.auth)(), (0, validate_1.validate)(categoryParamSchema), async (req, res) => {
    const { category } = req.params;
    const call = await advisoryCall_model_1.AdvisoryCallModel.findOne({ category }).sort({ postedAt: -1 }).lean();
    if (!call)
        return res.status(404).json({ error: 'no_message_for_category' });
    const existing = await callEntitlement_model_1.CallEntitlementModel.findOne({ uid: req.user.uid, callId: call.callId }).lean();
    if (existing)
        return res.json({ ok: true, alreadyUnlocked: true });
    const user = await user_model_1.UserModel.findOne({ uid: req.user.uid }).exec();
    if (!user)
        return res.status(404).json({ error: 'user_not_found' });
    if (user.wallet.actual < call.price) {
        const deficit = call.price - user.wallet.actual;
        const order = await (0, razorpay_1.createOrderRupees)(deficit, { purpose: 'call_unlock', category, callId: call.callId, uid: user.uid });
        return res.status(402).json({ error: 'insufficient_funds', need: deficit, order });
    }
    user.wallet.actual -= call.price;
    await user.save();
    await callEntitlement_model_1.CallEntitlementModel.create({ uid: user.uid, callId: call.callId, method: 'wallet', amount: call.price });
    await walletTxn_model_1.WalletTxnModel.create({
        uid: user.uid,
        wallet: 'actual',
        type: 'debit',
        amount: call.price,
        reason: 'call_unlock',
        ref: { callId: call.callId, category },
        balanceAfter: user.wallet.actual,
    });
    return res.json({ ok: true, method: 'wallet' });
});

// Admin helper: create message for a category
const adminCreateByCategorySchema = zod_1.z.object({
    params: zod_1.z.object({ category: zod_1.z.enum(['NIFTY', 'BANKNIFTY', 'SENSEX', 'COMMODITY', 'OTHERS']) }),
    body: zod_1.z.object({ title: zod_1.z.string().min(1), body: zod_1.z.string().min(1), price: zod_1.z.number().int().min(0).optional().default(116) }),
});
router.post('/admin/messages/:category', (0, auth_1.auth)(), (0, auth_1.requireRoles)(['superadmin', 'admin']), (0, validate_1.validate)(adminCreateByCategorySchema), async (req, res) => {
    const { category } = req.params;
    const { title, body, price } = req.body;
    const call = await advisoryCall_model_1.AdvisoryCallModel.create({
        callId: (0, id_1.genId)('call_'),
        category,
        title,
        titleUpper: title.toUpperCase(),
        body,
        price: price ?? 116,
        postedBy: req.user.uid,
        postedAt: new Date(),
    });
    res.json(call);
});

// Alias for clients expecting `/messages/latest5`
router.get('/messages/latest5', (0, auth_1.auth)(), async (req, res) => {
    const categories = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'COMMODITY', 'OTHERS'];
    const latest = await Promise.all(
        categories.map((cat) => advisoryCall_model_1.AdvisoryCallModel.findOne({ category: cat })
            .sort({ postedAt: -1 })
            .lean())
    );
    const calls = latest.filter(Boolean);
    const ids = calls.map((c) => c.callId);
    const ents = await callEntitlement_model_1.CallEntitlementModel.find({ uid: req.user.uid, callId: { $in: ids } })
        .select('callId')
        .lean();
    const entSet = new Set(ents.map((e) => e.callId));
    const result = {};
    categories.forEach((cat, i) => {
        const c = latest[i];
        if (!c) {
            result[cat] = null;
        }
        else {
            const unlocked = entSet.has(c.callId);
            result[cat] = {
                callId: c.callId,
                category: c.category,
                title: c.title,
                postedAt: c.postedAt,
                price: c.price,
                unlocked,
                ...(unlocked ? { body: c.body } : {}),
            };
        }
    });
    res.json(result);
});
