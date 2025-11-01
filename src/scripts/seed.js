"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_js_1 = require("../config/db.js");
const user_model_js_1 = require("../modules/users/user.model.js");
const advisoryCall_model_js_1 = require("../modules/calls/advisoryCall.model.js");
const id_js_1 = require("../utils/id.js");
async function run() {
    await (0, db_js_1.connectDB)();
    // SuperAdmin
    const superadmin = await user_model_js_1.UserModel.findOneAndUpdate({ email: 'superadmin@example.com' }, {
        $setOnInsert: {
            uid: (0, id_js_1.genId)('u_'),
            email: 'superadmin@example.com',
            role: 'superadmin',
            referralCode: (0, id_js_1.genId)('ref_'),
            status: 'active',
            wallet: { commission: 0, actual: 0 },
        },
    }, { upsert: true, new: true });
    // 3 Admins (marketing viewers)
    for (let i = 1; i <= 3; i++) {
        await user_model_js_1.UserModel.findOneAndUpdate({ email: `admin${i}@example.com` }, {
            $setOnInsert: {
                uid: (0, id_js_1.genId)('u_'),
                email: `admin${i}@example.com`,
                role: 'admin',
                referralCode: (0, id_js_1.genId)('ref_'),
                status: 'active',
                marketingRootUid: superadmin.uid,
                wallet: { commission: 0, actual: 0 },
            },
        }, { upsert: true });
    }
    // Seed demo calls
    const categories = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'COMMODITY', 'OTHERS'];
    for (const cat of categories) {
        await advisoryCall_model_js_1.AdvisoryCallModel.create({
            callId: (0, id_js_1.genId)('call_'),
            category: cat,
            title: `${cat} SIGNAL #${Math.floor(Math.random() * 1000)}`,
            titleUpper: `${cat} SIGNAL`.toUpperCase(),
            body: `Trade idea for ${cat}`,
            price: 116,
            postedBy: superadmin.uid,
            postedAt: new Date(),
        });
    }
    // Demo users
    for (let i = 1; i <= 25; i++) {
        await user_model_js_1.UserModel.findOneAndUpdate({ email: `demo${i}@example.com` }, {
            $setOnInsert: {
                uid: (0, id_js_1.genId)('u_'),
                email: `demo${i}@example.com`,
                role: 'demo',
                referralCode: (0, id_js_1.genId)('ref_'),
                status: 'active',
                wallet: { commission: 0, actual: 100000 },
            },
        }, { upsert: true });
    }
    // Top-6 exempt as special
    for (let i = 1; i <= 6; i++) {
        await user_model_js_1.UserModel.findOneAndUpdate({ email: `top${i}@example.com` }, {
            $setOnInsert: {
                uid: (0, id_js_1.genId)('u_'),
                email: `top${i}@example.com`,
                role: 'user',
                referralCode: (0, id_js_1.genId)('ref_'),
                status: 'active',
                isTop6Exempt: true,
                wallet: { commission: 0, actual: 0 },
            },
        }, { upsert: true });
    }
    // eslint-disable-next-line no-console
    console.log('Seed complete');
    process.exit(0);
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
