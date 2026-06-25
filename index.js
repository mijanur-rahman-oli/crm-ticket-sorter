require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CRM Ticket Sorter running on port ${PORT}`);
  console.log(`LLM mode: ${process.env.ANTHROPIC_API_KEY ? "enabled (Claude)" : "disabled (rule-based fallback)"}`);
});
