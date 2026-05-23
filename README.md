# SK Pay Worker

Cloudflare Workers payment bridge for SKG / sk-buy ecosystem.

This worker lets a small supplier connect their own payment page to SKG without giving payment secrets to SKG.

## Routes

```text
GET  /health
GET  /pay?order_id=...&amount=...&sig=...
POST /callback/:provider
```

## Required Secret

```bash
wrangler secret put SKG_CALLBACK_SECRET
```

## Local Dev

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Environment Variables

```text
SUPPLIER_ID       Supplier ID from SKG
SKG_CALLBACK_URL  SKG payment callback endpoint
PAYMENT_PAGE_URL  Supplier payment page URL
```

`SKG_CALLBACK_SECRET` must be stored as a Cloudflare secret.

## Callback Format Sent To SKG

```json
{
  "order_id": "SKG-O-xxx",
  "supplier_id": "SUP-xxx",
  "amount": "100.00",
  "paid_at": "2026-05-23T12:00:00.000Z",
  "status": "paid",
  "raw_provider": "epay",
  "raw_trade_no": "provider-trade-no"
}
```

The worker signs the JSON body with HMAC-SHA256 and sends it in:

```text
x-skg-signature
```
