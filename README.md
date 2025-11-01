# Stock Advisory + MLM Backend (Node.js, Express, MongoDB, TypeScript)

Production‑grade backend implementing:
- Auth via email OTP + JWT (access/refresh)
- Advisory Calls (NIFTY/BANKNIFTY/SENSEX/COMMODITY/OTHERS) with pay‑per‑message unlock (₹116) and 17 included calls
- Wallets (Actual, Commission), Razorpay Orders + Webhook (stub supported), withdrawals
- 10‑level MLM commissions on activation/renewal per given tables
- Validity, inactivity flush, deactivation, and daily cron
- OpenAPI at `/docs`, Jest tests, ESLint/Prettier, Docker, seeds

## Quick Start

1) Install dependencies
- Copy `.env.example` → `.env` and adjust if needed
- `npm install`

2) Run MongoDB + API via Docker
- `make docker-up` (or `docker compose up --build`)

3) Local dev
- Ensure Mongo is accessible (default `mongodb://localhost:27017/mlm`)
- `make dev` (hot reload)

4) Seed sample data
- `make seed`

5) Tests
- `make test`

## Environment
See `.env.example` for variables.

## Endpoints (high level)
- Auth: `POST /auth/request-otp`, `POST /auth/verify-otp`, `POST /auth/refresh`
- Users: `POST /users/register`, `GET /users/me`, `GET /users/me/tree`, `GET /users/me/wallet`
- Wallet: `POST /wallet/topup/order`, `POST /me/withdraw`, `GET /me/history/wallet`
- Calls: `GET /calls`, `GET /calls/:callId`, `POST /calls/:callId/unlock`, `GET /history/calls`
- Payments: `POST /payments/registration/order`, `POST /payments/renewal/order`, `POST /payments/webhook`, `GET /me/history/subscriptions`
- Admin: `POST /admin/calls`, `GET /admin/calls`, `GET /admin/dashboard`, `GET /admin/users`, `PATCH /admin/users/:uid/status`, `GET /admin/commissions`, `GET /admin/payouts`, `PATCH /admin/payouts/:id`, `POST /admin/seed/demo-users`

## Notes
- Money stored as integer rupees. Razorpay integration stubbed when keys not set.
- Critical flows (activation/renewal/topup) are wrapped in MongoDB transactions.
- Daily cron (02:00) marks inactivity/deactivation and flushes commissions on inactivity.
- SpecialUser/DemoUser unlocking behavior supported.
- OpenAPI served from `docs/openapi.yaml` at `/docs`.

## Makefile
- `make dev`, `make build`, `make start`, `make seed`, `make test`, `make lint`, `make docker-up`.

## License
Proprietary (adjust as needed).

