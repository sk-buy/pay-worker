export interface Env {
  SUPPLIER_ID: string;
  SKG_CALLBACK_URL: string;
  PAYMENT_PAGE_URL: string;
  SKG_CALLBACK_SECRET: string;
}

type ProviderPayload = Record<string, string>;

interface NormalizedPayment {
  order_id: string;
  supplier_id: string;
  amount: string;
  paid_at: string;
  status: "paid" | "pending" | "failed";
  raw_provider: string;
  raw_trade_no: string;
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

function getRequiredEnv(env: Env, key: keyof Env) {
  const value = String(env[key] || "").trim();
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

function normalizeStatus(value: string): NormalizedPayment["status"] {
  const status = value.toLowerCase();
  if (["paid", "success", "trade_success", "complete", "completed"].includes(status)) return "paid";
  if (["pending", "processing", "wait", "waiting"].includes(status)) return "pending";
  return "failed";
}

function pick(payload: ProviderPayload, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (value) return value;
  }
  return "";
}

async function readProviderPayload(request: Request): Promise<ProviderPayload> {
  const url = new URL(request.url);
  const payload: ProviderPayload = {};

  for (const [key, value] of url.searchParams.entries()) {
    payload[key] = value;
  }

  const contentType = request.headers.get("content-type") || "";
  if (request.method !== "GET" && contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) payload[key] = String(value);
    }
  }

  if (request.method !== "GET" && contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      payload[key] = String(value);
    }
  }

  return payload;
}

function normalizePayment(provider: string, payload: ProviderPayload, env: Env): NormalizedPayment {
  const orderId = pick(payload, ["order_id", "out_trade_no", "outTradeNo", "orderNo", "order"]);
  const amount = pick(payload, ["amount", "money", "total_amount", "totalAmount", "price"]);
  const status = pick(payload, ["status", "trade_status", "tradeStatus", "state"]) || "paid";
  const tradeNo = pick(payload, ["trade_no", "tradeNo", "transaction_id", "transactionId", "pay_id"]);
  const paidAt = pick(payload, ["paid_at", "paidAt", "time", "notify_time"]) || new Date().toISOString();

  return {
    order_id: orderId,
    supplier_id: getRequiredEnv(env, "SUPPLIER_ID"),
    amount,
    paid_at: paidAt,
    status: normalizeStatus(status),
    raw_provider: provider,
    raw_trade_no: tradeNo,
  };
}

async function hmacHex(secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function forwardToSkg(payment: NormalizedPayment, env: Env) {
  const body = JSON.stringify(payment);
  const signature = await hmacHex(getRequiredEnv(env, "SKG_CALLBACK_SECRET"), body);

  const response = await fetch(getRequiredEnv(env, "SKG_CALLBACK_URL"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-skg-signature": signature,
      "user-agent": "sk-buy-pay-worker/0.1",
    },
    body,
  });

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text,
  };
}

function buildPaymentRedirect(request: Request, env: Env) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id") || "";
  const amount = url.searchParams.get("amount") || "";
  const sig = url.searchParams.get("sig") || "";

  if (!orderId) return badRequest("order_id is required");

  const target = new URL(getRequiredEnv(env, "PAYMENT_PAGE_URL"));
  target.searchParams.set("order_id", orderId);
  if (amount) target.searchParams.set("amount", amount);
  if (sig) target.searchParams.set("sig", sig);
  target.searchParams.set("source", "skg");

  return Response.redirect(target.toString(), 302);
}

async function handleCallback(request: Request, env: Env, provider: string) {
  const payload = await readProviderPayload(request);
  const payment = normalizePayment(provider, payload, env);

  if (!payment.order_id) return badRequest("order_id is required");
  if (!payment.amount) return badRequest("amount is required");

  const skgResult = await forwardToSkg(payment, env);
  return json({
    ok: skgResult.ok,
    status: skgResult.status,
  }, { status: skgResult.ok ? 200 : 502 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return json({ ok: true, service: "sk-buy/pay-worker" });
      }

      if (url.pathname === "/pay") {
        return buildPaymentRedirect(request, env);
      }

      const callbackMatch = url.pathname.match(/^\/callback\/([^/]+)$/);
      if (callbackMatch) {
        return handleCallback(request, env, callbackMatch[1]);
      }

      return json({ error: "Not found" }, { status: 404 });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Internal error" },
        { status: 500 },
      );
    }
  },
};
