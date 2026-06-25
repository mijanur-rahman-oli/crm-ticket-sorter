/**
 * Deterministic rule-based classifier.
 * Used when ANTHROPIC_API_KEY is not set or when the LLM call fails.
 * Covers all 5 sample test cases and common Bangla/English mixed patterns.
 */

const PATTERNS = {
  phishing_or_social_engineering: [
    /\botp\b/i,
    /\bpin\b/i,
    /\bpassword\b/i,
    /asked.*(?:otp|pin|password)/i,
    /(?:otp|pin|password).*asked/i,
    /suspicious/i,
    /scam/i,
    /fraud(?:ster)?/i,
    /someone called/i,
    /fake\s+(?:call|sms|message)/i,
    /phishing/i,
    /verify.*account/i,
    /account.*verify/i,
    /verify.*account.*link/i,
    /bkash.*call/i,
    /nagad.*call/i,
    /agent.*called/i,
    /otp.*share/i,
    /share.*otp/i,
  ],
  wrong_transfer: [
    /wrong\s+(?:number|account|person|recipient)/i,
    /sent.*wrong/i,
    /transferred.*wrong/i,
    /wrong.*transfer/i,
    /wrong.*send/i,
    /mistake.*(?:transfer|send|sent)/i,
    /(?:transfer|send|sent).*mistake/i,
    /accidental(?:ly)?\s+(?:sent|transferred)/i,
    /ভুল নম্বর/,
    /ভুলে পাঠিয়ে/,
  ],
  payment_failed: [
    /payment\s+fail/i,
    /transaction\s+fail/i,
    /failed.*(?:payment|transaction)/i,
    /balance.*deduct/i,
    /deduct.*balance/i,
    /money.*deduct/i,
    /deduct.*money/i,
    /charge.*not.*(?:received|credited|reflect)/i,
    /not.*received.*but.*(?:charged|deducted)/i,
    /declined/i,
    /payment.*not.*processed/i,
    /error.*payment/i,
    /payment.*error/i,
  ],
  refund_request: [
    /refund/i,
    /money back/i,
    /get.*back.*money/i,
    /money.*back/i,
    /cancel.*(?:order|transaction|payment)/i,
    /changed.*mind/i,
    /return.*payment/i,
    /reimburse/i,
  ],
};

function classifyWithRules(message) {
  const text = message || "";

  // Check in priority order (phishing first — highest stakes)
  for (const [caseType, patterns] of Object.entries(PATTERNS)) {
    const matchCount = patterns.filter((p) => p.test(text)).length;
    if (matchCount > 0) {
      const confidence = Math.min(0.95, 0.65 + matchCount * 0.1);
      return buildResult(caseType, confidence);
    }
  }

  // Default
  return buildResult("other", 0.6);
}

function buildResult(caseType, confidence) {
  const config = CASE_CONFIG[caseType] || CASE_CONFIG["other"];
  return {
    case_type: caseType,
    severity: config.severity,
    department: config.department,
    agent_summary: config.summary,
    confidence: +confidence.toFixed(2),
  };
}

const CASE_CONFIG = {
  wrong_transfer: {
    severity: "high",
    department: "dispute_resolution",
    summary:
      "Customer reports sending money to an unintended recipient and is requesting recovery assistance.",
  },
  payment_failed: {
    severity: "high",
    department: "payments_ops",
    summary:
      "Customer reports a failed transaction where the balance may have been deducted without successful completion.",
  },
  refund_request: {
    severity: "low",
    department: "customer_support",
    summary:
      "Customer is requesting a refund for a recent transaction.",
  },
  phishing_or_social_engineering: {
    severity: "critical",
    department: "fraud_risk",
    summary:
      "Customer reports a suspected phishing or social engineering attempt targeting their account credentials.",
  },
  other: {
    severity: "low",
    department: "customer_support",
    summary:
      "Customer has submitted a general support request that requires further review.",
  },
};

module.exports = { classifyWithRules };
