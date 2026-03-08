// middleware/index.js

function requestLogger(req, res, next) {
    const action = req.body?.action ?? req.path;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} action=${action}`);
    next();
}

function errorHandler(err, req, res, next) {
    const status = err.status ?? 500;
    console.error(`[error] ${err.message}`, err.body ?? "");
    res.status(status).json({ error: err.message });
}

module.exports = { requestLogger, errorHandler };
