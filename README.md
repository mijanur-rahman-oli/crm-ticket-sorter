# CRM Ticket Sorter

An AI-powered microservice designed for real-time classification of digital finance customer support tickets. Built using Node.js, Express, and the Anthropic Claude API, this project was developed for the mock preliminary round of the SUST Hackathon.

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
- **LLM:** Claude via Anthropic API.
- **Fallback:** Regex rule-based classifier (zero external dependencies)
- **Deployment:** Render 

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
