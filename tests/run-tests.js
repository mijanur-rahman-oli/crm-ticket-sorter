require("dotenv").config();
const { classifyTicket } = require("../src/classifier");

const TEST_CASES = [
  {
    id: "T-001",
    message: "I sent 3000 to wrong number",
    expect: { case_type: "wrong_transfer", severity: "high", human_review_required: false },
  },
  {
    id: "T-002",
    message: "Payment failed but balance deducted",
    expect: { case_type: "payment_failed", severity: "high", human_review_required: false },
  },
  {
    id: "T-003",
    message: "Someone called asking my OTP, is that bKash?",
    expect: {
      case_type: "phishing_or_social_engineering",
      severity: "critical",
      human_review_required: true,
    },
  },
  {
    id: "T-004",
    message: "Please refund my last transaction, I changed my mind",
    expect: { case_type: "refund_request", severity: "low", human_review_required: false },
  },
  {
    id: "T-005",
    message: "App crashed when I opened it",
    expect: { case_type: "other", severity: "low", human_review_required: false },
  },
  {
    id: "T-006",
    message: "I sent 5000 taka to a wrong number this morning, please help me get it back",
    expect: { case_type: "wrong_transfer", severity: "high", human_review_required: false },
  },
  {
    id: "T-007",
    message: "Someone sent me a link saying verify your bKash account, what should I do?",
    expect: {
      case_type: "phishing_or_social_engineering",
      severity: "critical",
      human_review_required: true,
    },
  },
];

const SENSITIVE_WORDS = ["pin", "otp", "password", "card number"];

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log("=".repeat(60));
  console.log("CRM Ticket Sorter — Test Suite");
  console.log("=".repeat(60));

  for (const tc of TEST_CASES) {
    let result;
    try {
      result = await classifyTicket({
        ticket_id: tc.id,
        channel: "app",
        locale: "en",
        message: tc.message,
      });
    } catch (e) {
      console.error(`[FAIL] ${tc.id}: classifier threw — ${e.message}`);
      failed++;
      continue;
    }

    const errors = [];

    // Check ticket_id echo
    if (result.ticket_id !== tc.id) errors.push(`ticket_id mismatch: ${result.ticket_id}`);

    // Check expected fields
    for (const [key, expected] of Object.entries(tc.expect)) {
      if (result[key] !== expected) {
        errors.push(`${key}: expected "${expected}", got "${result[key]}"`);
      }
    }

    const summaryLower = (result.agent_summary || "").toLowerCase();
    for (const word of SENSITIVE_WORDS) {
      if (summaryLower.includes(word)) {
        errors.push(`SAFETY VIOLATION: agent_summary contains "${word}"`);
      }
    }

    if (typeof result.confidence !== "number" || result.confidence < 0 || result.confidence > 1) {
      errors.push(`confidence out of range: ${result.confidence}`);
    }

    if (errors.length === 0) {
      console.log(`[PASS] ${tc.id} — ${tc.message.slice(0, 55)}...`);
      passed++;
    } else {
      console.log(`[FAIL] ${tc.id} — ${tc.message.slice(0, 55)}...`);
      errors.forEach((e) => console.log(`       ✗ ${e}`));
      failed++;
    }

    console.log(
      `       → case_type=${result.case_type} severity=${result.severity} dept=${result.department} confidence=${result.confidence} human_review=${result.human_review_required}`
    );
    console.log(`       → summary: "${result.agent_summary}"`);
    console.log();
  }

  console.log("=".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed out of ${TEST_CASES.length} tests`);
  console.log("=".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
