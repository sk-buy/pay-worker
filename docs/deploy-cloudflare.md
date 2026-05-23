# Deploy To Cloudflare

## One-click Deploy

Open:

```text
https://deploy.workers.cloudflare.com/?url=https://github.com/sk-buy/pay-worker
```

Fill in your own EPay parameters:

```text
EPAY_PID
EPAY_KEY
EPAY_URL
```

After deployment, visit:

```text
https://your-worker-name.your-account.workers.dev/health
```

Then copy the Worker URL back to SKG.

## Manual Deploy

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
    "EPAY_PID": "your-epay-pid",
    "EPAY_URL": "https://your-epay.example.com/submit.php"
  }
}
```

5. Deploy:

```bash
npm run deploy
```
