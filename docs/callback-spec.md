# Callback Spec

Payment providers differ. This worker normalizes their result into one SKG callback payload.

## Input

Provider callback should call:

```text
POST /callback/:provider
```

The worker accepts JSON, form data, or query parameters.

## Normalized Fields

```text
order_id
amount
status
trade_no
paid_at
```

Status mapping:

```text
paid, success, trade_success, complete -> paid
pending, processing -> pending
failed, fail, closed, cancelled -> failed
```
