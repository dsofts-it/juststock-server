"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().default(8080),
    MONGO_URI: zod_1.z.string().min(1).default('mongodb://localhost:27017/mlm'),
    JWT_SECRET: zod_1.z.string().min(8).default('devsecret'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(8).default('devrefresh'),
    OTP_EXP_MIN: zod_1.z.coerce.number().int().default(10),
    RAZORPAY_KEY_ID: zod_1.z.string().optional().default(''),
    RAZORPAY_KEY_SECRET: zod_1.z.string().optional().default(''),
    WEB_BASE_URL: zod_1.z.string().url().default('http://localhost:8080'),
    SMTP_HOST: zod_1.z.string().optional().default(''),
    SMTP_PORT: zod_1.z.coerce.number().int().optional().default(587),
    SMTP_USER: zod_1.z.string().optional().default(''),
    SMTP_PASS: zod_1.z.string().optional().default(''),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsed.data;
