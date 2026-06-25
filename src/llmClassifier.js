const https = require("https");

const SYSTEM_PROMPT = `You are a CRM ticket classifier for a digital finance company in Bangladesh.
Given a customer support message, classify it and return ONLY a valid JSON object — no markdown, no explanation.

Return this exact shape:
{
  "case_type": "<enum>",
  "severity": "<enum>",
  "department": "<enum>",
  "agent_summary": "<string>",
  "confidence": <float>
}

case_type enum values:
- wrong_transfer         → money sent to wrong recipient
- payment_failed         → transaction failed, balance may be deducted
- refund_request         → customer wants a refund
- phishing_or_social_engineering → suspicious calls/SMS, someone asking for PIN/OTP/password
- other                  → anything else

severity enum values:
- low      → minor inconvenience, no money at risk
- medium   → inconvenience with potential money impact
- high     → confirmed money at risk or already lost
- critical → phishing/fraud, or risk of immediate financial harm

department enum values:
- customer_support      → general questions, other, low-severity refunds
- dispute_resolution    → wrong_transfer, contested refunds
- payments_ops          → payment_failed
- fraud_risk            → phishing_or_social_engineering

Rules:
1. agent_summary must be 1-2 neutral sentences an agent can read in 2 seconds.
2. agent_summary must NEVER instruct the customer to share PIN, OTP, password, or card number.
3. phishing_or_social_engineering always gets severity=critical and department=fraud_risk.
4. confidence is a float 0.0-1.0 reflecting your certainty.`;

function anthropicRequest(message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }],
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse Anthropic response: " + data));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(25000, () => {
      req.destroy(new Error("Anthropic API request timed out"));
    });
    req.write(body);
    req.end();
  });
}

async function classifyWithLLM(message) {
  const apiResponse = await anthropicRequest(message);

  if (apiResponse.error) {
    throw new Error(apiResponse.error.message || JSON.stringify(apiResponse.error));
  }

  const rawText = apiResponse.content?.[0]?.text || "";

  // Strip markdown fences if present
  const cleaned = rawText.replace(/```json|```/gi, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("LLM returned invalid JSON: " + rawText);
  }

  // Validate enums
  const validCaseTypes = [
    "wrong_transfer",
    "payment_failed",
    "refund_request",
    "phishing_or_social_engineering",
    "other",
  ];
  const validSeverities = ["low", "medium", "high", "critical"];
  const validDepartments = [
    "customer_support",
    "dispute_resolution",
    "payments_ops",
    "fraud_risk",
  ];

  if (!validCaseTypes.includes(parsed.case_type)) parsed.case_type = "other";
  if (!validSeverities.includes(parsed.severity)) parsed.severity = "medium";
  if (!validDepartments.includes(parsed.department)) parsed.department = "customer_support";
  if (typeof parsed.confidence !== "number") parsed.confidence = 0.75;

  // Clamp confidence
  parsed.confidence = Math.min(1, Math.max(0, parsed.confidence));

  return parsed;
}

module.exports = { classifyWithLLM };
