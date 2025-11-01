"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const error_1 = require("./middleware/error");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const wallet_routes_1 = __importDefault(require("./modules/wallet/wallet.routes"));
const calls_routes_1 = __importDefault(require("./modules/calls/calls.routes"));
const payments_routes_1 = __importDefault(require("./modules/payments/payments.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const app = (0, express_1.default)();
// Behind a proxy on Render; ensure correct IPs and secure headers
app.set('trust proxy', 1);
// Relax CORP for API responses to avoid cross-origin fetch issues
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
// Explicit CORS setup for broad, global access (Flutter Web friendly)
const corsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '1mb' }));
app.use((0, express_rate_limit_1.default)({ windowMs: 60000, max: 120 }));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', auth_routes_1.default);
app.use('/users', users_routes_1.default);
app.use('/', wallet_routes_1.default); // /me/withdraw, /wallet/*
app.use('/', calls_routes_1.default); // /calls
app.use('/', payments_routes_1.default); // /payments/*
app.use('/', admin_routes_1.default);
const openapiPath = path_1.default.join(process.cwd(), 'docs', 'openapi.yaml');
if (fs_1.default.existsSync(openapiPath)) {
    const file = fs_1.default.readFileSync(openapiPath, 'utf8');
    const spec = yaml_1.default.parse(file);
    app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(spec));
}
app.use(error_1.errorHandler);
exports.default = app;
