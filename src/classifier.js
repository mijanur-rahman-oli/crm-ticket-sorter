const { classifyWithLLM } = require("./llmClassifier");
const { classifyWithRules } = require("./ruleClassifier");

/**
 * Main entry point. Tries LLM first; if ANTHROPIC_API_KEY is absent or the
 * call fails it falls back to the deterministic rule-based classifier.
 */
async function classifyTicket({ ticket_id, channel, locale, message }) {
  const useAI = !!process.env.ANTHROPIC_API_KEY;

  let result;
  if (useAI) {
    try {
      result = await classifyWithLLM(message);
    } catch (err) {
      console.warn("LLM classification failed, falling back to rules:", err.message);
      result = classifyWithRules(message);
    }
  } else {
    result = classifyWithRules(message);
  }

  // Enforce safety rule: agent_summary must never contain sensitive prompts
  result.agent_summary = sanitizeSummary(result.agent_summary);

  // Derive human_review_required — per spec: phishing or critical severity only
  result.human_review_required =
    result.severity === "critical" || result.case_type === "phishing_or_social_engineering";

  return {
    ticket_id,
    case_type: result.case_type,
    severity: result.severity,
    department: result.department,
    agent_summary: result.agent_summary,
    human_review_required: result.human_review_required,
    confidence: result.confidence,
  };
}

/**
 * Strip any accidental instruction to share PIN/OTP/password/card number.
 */
function sanitizeSummary(summary) {
  const banned = /\b(pin|otp|password|full card number|card number)\b/gi;
  return summary.replace(banned, "[REDACTED]");
}

module.exports = { classifyTicket };
