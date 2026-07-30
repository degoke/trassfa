# trassfa

trassfa is an MVP for two-way crypto and fiat settlement on top of the Skyewallet API:

- Send crypto and settle the recipient in NGN to a bank account
- Receive a fiat bank transfer and settle the beneficiary in crypto

## What trassfa is

trassfa bridges on-chain wallets and local bank rails. A sender can pay from USDT or USDC on TRON or Solana; the receiver gets NGN in a normal bank account. The reverse works too — someone pays into a generated NGN virtual account, and the beneficiary receives crypto in their wallet.

The product is built for everyday moments: a dinner bill, a POS cash-out, an urgent transfer to someone who only has a bank account, or receiving fiat when you want to hold crypto instead.

**Supported today**

| | |
|---|---|
| **Crypto assets** | USDT, USDC |
| **Networks** | TRON (TRX), Solana (SOL) |
| **Fiat** | NGN (Nigeria) |
| **Auth** | Email/password + phone number |

Under the hood, trassfa orchestrates quotes, bank resolution, Skyewallet swap/settlement, webhooks, and fee logic. Users interact through a mobile-first web app.

## Screenshots

### Landing page

Marketing site at `/` — explains the product story, flows, and entry points into the app.

![trassfa landing page](docs/screenshots/landing.png)

### Create account

Sign up with name, Nigerian phone number (+234), email, and password.

![Create account](docs/screenshots/auth.png)

### Send — crypto to bank

Pay from a wallet and settle to a Nigerian bank account. Quote in Naira or crypto, pick asset and network, resolve the bank account, then fund the generated deposit address.

![Send crypto to bank](docs/screenshots/send.png)

### Receive — bank to crypto

Accept an NGN transfer and settle into a wallet. Enter the amount, choose the crypto asset and network, and provide the destination wallet address.

![Receive bank to crypto](docs/screenshots/receive.png)

## Getting started

### 1. Get a Skyewallet account

trassfa depends on [Skyewallet](https://skyewallet.com) for rates, swaps, virtual accounts, crypto deposit addresses, bank payouts, and webhooks.

1. Create a Skyewallet business account.
2. Generate an API key from the dashboard (use the **test** environment while developing).
3. Copy the webhook secret Skyewallet provides for signature verification.
4. In the Skyewallet dashboard, point webhooks at your API:

   ```
   https://<your-api-host>/webhooks/skyewallet
   ```

   For local development, expose port `8787` with a tunnel (e.g. ngrok, Cloudflare Tunnel) and use that public URL.

Skyewallet handles the actual money movement; trassfa is the app layer on top.

### 2. Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) 11+
- PostgreSQL 16+

### 3. Clone and install

```bash
git clone <repo-url>
cd skye-spend
pnpm install
```

### 4. Configure environment

Copy the example env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/linkpay
WEB_APP_URL=http://localhost:5173
BETTER_AUTH_URL=http://localhost:8787
BETTER_AUTH_SECRET=<long-random-secret>
ENCRYPTION_KEY=<at-least-32-characters>
SKYEWALLET_API_KEY=<your-skyewallet-api-key>
SKYEWALLET_BASE_URL=https://test--pay.skyewallet.com
SKYEWALLET_WEBHOOK_SECRET=<your-webhook-secret>
ADMIN_EMAILS=you@example.com
ADMIN_API_TOKEN=<long-random-admin-token>
```

`apps/web/.env` only needs the API URL for local dev:

```bash
VITE_API_URL=http://localhost:8787
```

### 5. Database and auth schema

```bash
pnpm db:migrate
```

Regenerate the Better Auth schema when auth config changes:

```bash
pnpm auth:generate
```

### 6. Run the app

```bash
pnpm dev
```

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:8787 |
| Health check | http://localhost:8787/health |

Open the landing page, create an account at `/auth`, then use **Send** or **Receive** from the app shell.

### 7. Quality checks

```bash
pnpm check    # format, typecheck, lint, test
pnpm build    # production build
```

## Stack

- `apps/web` — React + Vite + TanStack Router
- `apps/api` — Hono API for orchestration, pricing, bank resolution, and webhook handling
- Postgres + Drizzle for transactions, references, and webhook event storage
- Better Auth for email/password auth and cookie-backed sessions
- `pnpm` workspace managed with Turborepo

## MVP flows

### Crypto to bank

1. Resolve the bank account.
2. Quote `crypto -> NGN`.
3. Create a dynamic Skyewallet crypto account for the transaction.
4. Wait for webhook confirmation.
5. Execute the swap.
6. Subtract trassfa fees.
7. Send NGN payout to the resolved account.

### Bank transfer to crypto

1. Quote `NGN -> crypto`.
2. Create a static NGN virtual account for the transaction.
3. Wait for bank transfer webhook confirmation.
4. Execute the swap.
5. Subtract trassfa fees.
6. Send crypto payout to the linked wallet address.

## Docker

A multi-stage `Dockerfile` builds separate `api` and `web` images. Docker builds are commented out in CI for now; `pnpm build` runs in the pipeline instead.

```bash
# API
docker build --target api -t trassfa-api .
docker run -p 8787:8787 --env-file apps/api/.env trassfa-api

# Web (set API URL at build time)
docker build --target web --build-arg VITE_API_URL=https://api.example.com -t trassfa-web .
docker run -p 8080:80 trassfa-web
```

## License

Source available under the [trassfa Source Available License](LICENSE).

- You may view, modify, fork, and redistribute the code (keep the license).
- Development, testing, and evaluation are always allowed.
- Non-commercial production use is allowed.
- Commercial production use requires a separate written license.
- There is **no expiry date** — the project does not automatically relicense to Apache or any other license.
