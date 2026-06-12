# LinkPay

LinkPay is an MVP for two-way crypto and fiat settlement on top of the Skyewallet API:

- Send crypto and settle the recipient in NGN to a bank account
- Receive a fiat bank transfer and settle the beneficiary in crypto

## Stack

- `apps/web`: React + Vite + TanStack Router
- `apps/api`: Hono API for orchestration, pricing, bank resolution, and webhook handling
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
6. Subtract LinkPay fees.
7. Send NGN payout to the resolved account.

### Bank transfer to crypto

1. Quote `NGN -> crypto`.
2. Create a static NGN virtual account for the transaction.
3. Wait for bank transfer webhook confirmation.
4. Execute the swap.
5. Subtract LinkPay fees.
6. Send crypto payout to the linked wallet address.

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. Set auth secrets and origins in `apps/api/.env`:

```bash
BETTER_AUTH_URL=http://localhost:8787
WEB_APP_URL=http://localhost:5173
BETTER_AUTH_SECRET=your-long-random-secret
```

4. Apply committed migrations:

```bash
pnpm db:migrate
```

5. Regenerate the Better Auth schema when auth config changes:

```bash
pnpm auth:generate
```

6. Run both apps:

```bash
pnpm dev
```

## Important MVP notes

- Transaction storage is persisted in Postgres through Drizzle.
- Better Auth’s Drizzle schema is generated into `apps/api/src/db/auth-schema.ts`; treat that file as generated output and refresh it with `pnpm auth:generate`.
- Drizzle SQL migrations live in `apps/api/drizzle`; generate new ones with `pnpm db:generate` and apply them with `pnpm db:migrate`.
- Better Auth stores users, accounts, sessions, and verification records in the same Postgres database.
- Webhooks are verified with `X-Skyewallet-Business-Signature` using the configured webhook secret.
- Webhook deliveries are deduplicated before background processing and persisted in `webhook_events`.
- The webhook endpoint responds immediately and processes settlement work asynchronously in-process. Move this to a real queue before production.
