# Deploy To Cloudflare

1. Install dependencies:

```bash
npm install
```

2. Login Cloudflare:

```bash
npx wrangler login
```

3. Set the SKG callback secret:

```bash
npx wrangler secret put SKG_CALLBACK_SECRET
```

4. Edit `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "SUPPLIER_ID": "your-skg-supplier-id",
    "SKG_CALLBACK_URL": "https://skg.sk-buy.com/api/skg/payment/callback",
    "PAYMENT_PAGE_URL": "https://your-payment-site.example.com/order"
  }
}
```

5. Deploy:

```bash
npm run deploy
```
