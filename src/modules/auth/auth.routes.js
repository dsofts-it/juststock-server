"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../../middleware/validate");
const env_1 = require("../../config/env");
const otp_model_1 = require("./otp.model");
const mailer_1 = require("../../lib/mailer");
const date_fns_1 = require("date-fns");
const argon2_1 = __importDefault(require("argon2"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../users/user.model");
const id_1 = require("../../utils/id");
const router = (0, express_1.Router)();

// New: manual signup with name, email, password, confirmPassword, mobile
const signupSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1),
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(8),
        confirmPassword: zod_1.z.string().min(8),
        mobile: zod_1.z.string().min(8),
    }).refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'password_mismatch' }),
});

router.post('/signup', (0, validate_1.validate)(signupSchema), async (req, res) => {
    const { name, email, password, mobile } = req.body;
    const lower = email.toLowerCase();
    const existing = await user_model_1.UserModel.findOne({ email: lower }).lean();
    if (existing)
        return res.status(409).json({ error: 'email_exists' });
    const passwordHash = await argon2_1.default.hash(password);
    const user = await user_model_1.UserModel.create({
        uid: (0, id_1.genId)('u_'),
        name,
        email: lower,
        phone: mobile,
        passwordHash,
        role: 'user',
        referralCode: (0, id_1.genId)('ref_'),
        wallet: { commission: 0, actual: 0 },
        includedCallsRemaining: 17,
        directReferralsCount: 0,
        status: 'inactive',
    });
    const access = jsonwebtoken_1.default.sign({ uid: user.uid }, env_1.env.JWT_SECRET, { expiresIn: '15m' });
    const refresh = jsonwebtoken_1.default.sign({ uid: user.uid }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
    res.status(201).json({ accessToken: access, refreshToken: refresh });
});

// New: password login (with hardcoded superadmin)
const loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(8),
    }),
});

router.post('/login', (0, validate_1.validate)(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const lower = email.toLowerCase();
    // Hardcoded superadmin direct login
    if (lower === 'robin@shaktirise.in' && password === '12345678') {
        let sa = await user_model_1.UserModel.findOne({ email: lower }).exec();
        if (!sa) {
            sa = await user_model_1.UserModel.create({
                uid: (0, id_1.genId)('u_'),
                name: 'Super Admin',
                email: lower,
                role: 'superadmin',
                referralCode: (0, id_1.genId)('ref_'),
                wallet: { commission: 0, actual: 0 },
                includedCallsRemaining: 17,
                directReferralsCount: 0,
                status: 'active',
            });
        } else if (sa.role !== 'superadmin') {
            sa.role = 'superadmin';
            await sa.save();
        }
        const access = jsonwebtoken_1.default.sign({ uid: sa.uid }, env_1.env.JWT_SECRET, { expiresIn: '15m' });
        const refresh = jsonwebtoken_1.default.sign({ uid: sa.uid }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
        return res.json({ accessToken: access, refreshToken: refresh });
    }
    // Normal user login
    const user = await user_model_1.UserModel.findOne({ email: lower }).exec();
    if (!user || !user.passwordHash)
        return res.status(401).json({ error: 'invalid_credentials' });
    const ok = await argon2_1.default.verify(user.passwordHash, password);
    if (!ok)
        return res.status(401).json({ error: 'invalid_credentials' });
    const access = jsonwebtoken_1.default.sign({ uid: user.uid }, env_1.env.JWT_SECRET, { expiresIn: '15m' });
    const refresh = jsonwebtoken_1.default.sign({ uid: user.uid }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
    res.json({ accessToken: access, refreshToken: refresh });
});
const requestOtpSchema = zod_1.z.object({
    body: zod_1.z.object({ email: zod_1.z.string().email() }),
});
router.post('/request-otp', (0, validate_1.validate)(requestOtpSchema), async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await argon2_1.default.hash(code);
    const expiresAt = (0, date_fns_1.addMinutes)(new Date(), env_1.env.OTP_EXP_MIN);
    await otp_model_1.OtpModel.create({ email: email.toLowerCase(), codeHash, expiresAt });
    await (0, mailer_1.getMailer)().sendMail({ to: email, subject: 'Your OTP', text: `Your OTP is ${code}` });
    res.json({ ok: true });
});
const verifyOtpSchema = zod_1.z.object({
    body: zod_1.z.object({ email: zod_1.z.string().email(), code: zod_1.z.string().length(6) }),
});
router.post('/verify-otp', (0, validate_1.validate)(verifyOtpSchema), async (req, res) => {
    const { email, code } = req.body;
    const otp = await otp_model_1.OtpModel.findOne({ email: email.toLowerCase() }).sort({ expiresAt: -1 }).exec();
    if (!otp || otp.consumedAt || otp.expiresAt < new Date())
        return res.status(400).json({ error: 'invalid_otp' });
    const ok = await argon2_1.default.verify(otp.codeHash, code);
    if (!ok)
        return res.status(400).json({ error: 'invalid_otp' });
    otp.consumedAt = new Date();
    await otp.save();
    let user = await user_model_1.UserModel.findOne({ email: email.toLowerCase() }).exec();
    if (!user) {
        user = await user_model_1.UserModel.create({
            uid: (0, id_1.genId)('u_'),
            email: email.toLowerCase(),
            role: 'user',
            referralCode: (0, id_1.genId)('ref_'),
            wallet: { commission: 0, actual: 0 },
            includedCallsRemaining: 17,
            directReferralsCount: 0,
            status: 'inactive',
        });
    }
    const access = jsonwebtoken_1.default.sign({ uid: user.uid }, env_1.env.JWT_SECRET, { expiresIn: '15m' });
    const refresh = jsonwebtoken_1.default.sign({ uid: user.uid }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
    res.json({ accessToken: access, refreshToken: refresh });
});
const refreshSchema = zod_1.z.object({ body: zod_1.z.object({ refreshToken: zod_1.z.string().min(1) }) });
router.post('/refresh', (0, validate_1.validate)(refreshSchema), async (req, res) => {
    const { refreshToken } = req.body;
    try {
        const payload = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET);
        const access = jsonwebtoken_1.default.sign({ uid: payload.uid }, env_1.env.JWT_SECRET, { expiresIn: '15m' });
        return res.json({ accessToken: access });
    }
    catch {
        return res.status(401).json({ error: 'invalid_token' });
    }
});
exports.default = router;
