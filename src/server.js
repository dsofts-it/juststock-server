"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const logger_1 = require("./config/logger");
const app_1 = __importDefault(require("./app"));
const index_1 = require("./jobs/index");
async function main() {
    await (0, db_1.connectDB)();
    (0, index_1.startJobs)();
    app_1.default.listen(env_1.env.PORT, () => logger_1.logger.info(`API listening on :${env_1.env.PORT}`));
}
main().catch((err) => {
    logger_1.logger.error({ err }, 'Failed to start');
    process.exit(1);
});
