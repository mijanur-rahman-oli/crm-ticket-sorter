# CRM Ticket Sorter

An AI-powered microservice that classifies digital finance customer support tickets in real-time. Built with Node.js, Express, and the Anthropic Claude API — with a deterministic rule-based fallback so the service works even without an API key.

---

## What It Does

Given a raw customer message, the service returns:

| Field | Description |
|---|---|
| `case_type` | `wrong_transfer` / `payment_failed` / `refund_request` / `phishing_or_social_engineering` / `other` |
| `severity` | `low` / `medium` / `high` / `critical` |
| `department` | `customer_support` / `dispute_resolution` / `payments_ops` / `fraud_risk` |
| `agent_summary` | 1–2 neutral sentences for a human agent |
| `human_review_required` | `true` for critical severity or phishing cases |
| `confidence` | Float 0.0–1.0 |

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4
- **LLM:** Claude (`claude-sonnet-4-6`) via Anthropic API — optional
- **Fallback:** Regex rule-based classifier (zero external dependencies)
- **Deployment:** Render / Railway / Fly.io / any Node host

---

## Project Structure

```
crm-ticket-sorter/
├── index.js                # Entry point — starts the HTTP server
├── src/
│   ├── app.js              # Express routes (/health, /sort-ticket)
│   ├── classifier.js       # Orchestrator: LLM → rule fallback
│   ├── llmClassifier.js    # Anthropic API call + response validation
│   └── ruleClassifier.js   # Deterministic regex-based classifier
├── tests/
│   └── run-tests.js        # 7 test cases (no external test runner)
├── .env.example            # Template for environment variables
├── render.yaml             # One-click Render deployment
├── railway.toml            # Railway deployment config
├── package.json
└── README.md
```

---

## API Reference

### `GET /health`

Returns service health status.

**Response:**
```json
{
  "status": "ok",
  "service": "crm-ticket-sorter",
  "timestamp": "2025-06-25T10:00:00.000Z"
}
```

---

### `POST /sort-ticket`

Classifies a single CRM ticket.

**Request body:**
```json
{
  "ticket_id": "T-001",
  "channel": "app",
  "locale": "en",
  "message": "I sent 5000 taka to a wrong number this morning, please help me get it back"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `ticket_id` | string | Yes | Echoed back in the response |
| `channel` | string | No | `app`, `sms`, `call_center`, `merchant_portal` |
| `locale` | string | No | `bn`, `en`, `mixed` |
| `message` | string | Yes | Free-text customer complaint |

**Response:**
```json
{
  "ticket_id": "T-001",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports sending 5000 BDT to an unintended recipient and is requesting recovery assistance.",
  "human_review_required": true,
  "confidence": 0.91
}
```

**Error responses:**

| Status | Reason |
|---|---|
| 400 | Missing or invalid `ticket_id` or `message` |
| 500 | Internal classification error |

---

## Local Development

### Prerequisites

- Node.js 18 or higher
- npm 8+
- (Optional) Anthropic API key for LLM mode

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/crm-ticket-sorter.git
cd crm-ticket-sorter
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required for LLM mode — omit to use rule-based fallback
ANTHROPIC_API_KEY=sk-ant-...

# Optional — defaults to 3000
PORT=3000
```

### 4. Start the server

```bash
# Production
npm start

# Development with auto-reload
npm run dev
```

The service starts at `http://localhost:3000`.

### 5. Verify it's running

```bash
curl http://localhost:3000/health
```

### 6. Run the test suite

```bash
npm test
```

---

## Quick Smoke Tests (curl)

```bash
# Wrong transfer
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"T-001","message":"I sent 3000 to wrong number"}'

# Phishing
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"T-003","message":"Someone called asking my OTP, is that bKash?"}'

# Payment failed
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"T-002","message":"Payment failed but balance deducted"}'
```

---

## Deployment

### Option A — Render (Recommended)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — click **Apply**
5. In the Render dashboard → Environment → add `ANTHROPIC_API_KEY`
6. Deploy — your HTTPS URL is ready in ~2 minutes

### Option B — Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variable: `ANTHROPIC_API_KEY` in the Railway dashboard
5. Railway auto-reads `railway.toml` and deploys

### Option C — Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch        # follow prompts, choose a region
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

### Option D — Manual VPS / EC2

```bash
# On the server
git clone https://github.com/YOUR_USERNAME/crm-ticket-sorter.git
cd crm-ticket-sorter
npm install --production

# Set env vars
export ANTHROPIC_API_KEY=sk-ant-...
export PORT=3000

# Run with PM2 for process management
npm install -g pm2
pm2 start index.js --name crm-ticket-sorter
pm2 save
pm2 startup   # enable auto-start on reboot
```

For HTTPS on a VPS, use nginx as a reverse proxy with Let's Encrypt:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Classification Logic

### Mode 1 — LLM (when `ANTHROPIC_API_KEY` is set)

1. Message is sent to `claude-sonnet-4-6` with a structured system prompt
2. Claude returns a JSON object with `case_type`, `severity`, `department`, `agent_summary`, `confidence`
3. Response is validated against enums; invalid values fall back to safe defaults
4. If the LLM call fails (timeout, API error), the service automatically falls back to Mode 2

### Mode 2 — Rule-Based Fallback (no API key needed)

A regex pattern table covers:
- **Phishing:** OTP, PIN, password requests, suspicious calls
- **Wrong transfer:** "wrong number", "sent to wrong", accidental transfer phrases
- **Payment failed:** failed transaction, balance deducted patterns
- **Refund:** refund, money back, changed mind, cancel
- **Other:** anything not matched

### Safety Rule

The `agent_summary` field is post-processed to replace any accidental mention of `PIN`, `OTP`, `password`, or `card number` with `[REDACTED]`. This applies in both LLM and rule-based modes.

### `human_review_required` Logic

```
human_review_required = (severity === "critical") OR (case_type === "phishing_or_social_engineering")
```

---

## Sample Test Cases & Expected Results

| # | Message | Expected `case_type` | Severity |
|---|---|---|---|
| 1 | I sent 3000 to wrong number | `wrong_transfer` | high |
| 2 | Payment failed but balance deducted | `payment_failed` | high |
| 3 | Someone called asking my OTP, is that bKash? | `phishing_or_social_engineering` | critical |
| 4 | Please refund my last transaction, I changed my mind | `refund_request` | low |
| 5 | App crashed when I opened it | `other` | low |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | No | — | Enables LLM mode. Without it, rule-based fallback is used. |
| `PORT` | No | `3000` | HTTP port the server listens on |

---

## LLM Usage

**Yes — Claude (`claude-sonnet-4-6`) via the Anthropic Messages API.**

The service works fully without it (rule-based fallback). The LLM improves handling of ambiguous, mixed-language (Bangla/English), and nuanced messages.

---

## Known Limitations

- Rule-based fallback may misclassify highly ambiguous or novel phrasing not covered by the pattern table
- LLM mode adds ~1–3s latency per request (well within the 30s SLA)
- No persistent storage — each request is stateless
