"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = auth;
exports.requireRoles = requireRoles;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const user_model_1 = require("../modules/users/user.model");
function auth(required = true) {
    return async (req, res, next) => {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
        if (!token) {
            if (required)
                return res.status(401).json({ error: 'missing_token' });
            return next();
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
            const user = await user_model_1.UserModel.findOne({ uid: payload.uid }).lean();
            if (!user)
                return res.status(401).json({ error: 'invalid_token' });
            req.user = user;
            return next();
        }
        catch (e) {
            return res.status(401).json({ error: 'invalid_token' });
        }
    };
}
function requireRoles(roles) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role || !roles.includes(role))
            return res.status(403).json({ error: 'forbidden' });
        next();
    };
}
