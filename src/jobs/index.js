"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobs = startJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const user_model_js_1 = require("../modules/users/user.model.js");
const walletTxn_model_js_1 = require("../modules/wallet/walletTxn.model.js");
function startJobs() {
    // Daily 02:00
    node_cron_1.default.schedule('0 2 * * *', async () => {
        const now = new Date();
        const inactiveCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const deactivatedCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const toInactive = await user_model_js_1.UserModel.find({ status: 'active', validUntil: { $lt: inactiveCutoff }, role: { $nin: ['special', 'demo'] } });
        for (const u of toInactive) {
            u.status = 'inactive';
            const balance = u.wallet.commission;
            if (balance > 0) {
                u.wallet.commission = 0;
                await u.save();
                await walletTxn_model_js_1.WalletTxnModel.create({
                    uid: u.uid,
                    wallet: 'commission',
                    type: 'debit',
                    amount: balance,
                    reason: 'flush',
                    balanceAfter: 0,
                });
            }
            else {
                await u.save();
            }
        }
        await user_model_js_1.UserModel.updateMany({ status: { $ne: 'deactivated' }, validUntil: { $lt: deactivatedCutoff }, role: { $nin: ['special', 'demo'] } }, { $set: { status: 'deactivated' } });
    });
}
