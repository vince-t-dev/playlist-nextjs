require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const actionRouter = require("./routes/actions");
const { requestLogger, errorHandler } = require("./middleware");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json({ limit: "10mb" }));
app.use(cors({
    origin: process.env.NEXTJS_URL || "http://nextjs:3000",
    methods: ["POST", "GET"],
}));
app.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));
app.use(requestLogger);

app.get("/health", (req, res) => res.json({ ok: true }));
app.post("/content_api", actionRouter);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`[api] Express listening on :${PORT}`);
    console.log(`[api] Proxying → ${process.env.DOMAIN_URL}`);
});