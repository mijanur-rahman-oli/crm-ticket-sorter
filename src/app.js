const express = require("express");
const { classifyTicket } = require("./classifier");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "crm-ticket-sorter",
    timestamp: new Date().toISOString(),
  });
});

app.post("/sort-ticket", async (req, res) => {
  const { ticket_id, channel, locale, message } = req.body;

  if (!ticket_id || typeof ticket_id !== "string") {
    return res.status(400).json({ error: "ticket_id is required and must be a string." });
  }
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "message is required and must be a non-empty string." });
  }

  try {
    const result = await classifyTicket({ ticket_id, channel, locale, message });
    return res.json(result);
  } catch (err) {
    console.error("Classification error:", err.message);
    return res.status(500).json({ error: "Internal classification error.", detail: err.message });
  }
});

module.exports = app;
