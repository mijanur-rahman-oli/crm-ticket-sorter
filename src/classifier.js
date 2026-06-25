const { classifyWithLLM } = require("./llmClassifier");
const { classifyWithRules } = require("./ruleClassifier");

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

  result.agent_summary = sanitizeSummary(result.agent_summary);
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

function sanitizeSummary(summary) {
  const banned = /\b(pin|otp|password|full card number|card number)\b/gi;
  return summary.replace(banned, "[REDACTED]");
}

module.exports = { classifyTicket };
