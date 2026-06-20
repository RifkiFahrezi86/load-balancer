const http = require("node:http");
const os = require("node:os");

const port = Number(process.env.PORT || 3000);
const serverName = process.env.SERVER_NAME || "server";
const serverColor = process.env.SERVER_COLOR || "#ffffff";
const serverIndex = Number(process.env.SERVER_INDEX || 0);
const defaultBaseDelayMs = Number(process.env.BASE_DELAY_MS || 450);
const defaultExtraDelayMs = Number(process.env.EXTRA_DELAY_MS || 0);

let runtimeConfig = {
  baseDelayMs: defaultBaseDelayMs,
  extraDelayMs: defaultExtraDelayMs,
};

let activeConnections = 0;
let totalRequests = 0;
let completedRequests = 0;
let totalProcessingMs = 0;
let peakActiveConnections = 0;
let lastRequest = null;
let history = [];

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload terlalu besar"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Body JSON tidak valid"));
      }
    });
    req.on("error", reject);
  });
}

function resetMetrics() {
  activeConnections = 0;
  totalRequests = 0;
  completedRequests = 0;
  totalProcessingMs = 0;
  peakActiveConnections = 0;
  lastRequest = null;
  history = [];
}

function snapshot() {
  return {
    serverName,
    serverColor,
    serverIndex,
    hostname: os.hostname(),
    activeConnections,
    totalRequests,
    completedRequests,
    peakActiveConnections,
    baseDelayMs: runtimeConfig.baseDelayMs,
    extraDelayMs: runtimeConfig.extraDelayMs,
    averageProcessingMs: completedRequests > 0 ? totalProcessingMs / completedRequests : 0,
    lastRequest,
    history,
  };
}

function notFound(res) {
  sendJson(res, 404, { error: "Route tidak ditemukan" });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, { ok: true, serverName });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/status") {
    sendJson(res, 200, snapshot());
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/reset") {
    resetMetrics();
    sendJson(res, 200, { ok: true, status: snapshot() });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/config") {
    try {
      const body = await parseBody(req);

      if (typeof body.baseDelayMs === "number" && Number.isFinite(body.baseDelayMs)) {
        runtimeConfig.baseDelayMs = Math.max(0, Math.round(body.baseDelayMs));
      }

      if (typeof body.extraDelayMs === "number" && Number.isFinite(body.extraDelayMs)) {
        runtimeConfig.extraDelayMs = Math.max(0, Math.round(body.extraDelayMs));
      }

      sendJson(res, 200, { ok: true, status: snapshot() });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/request") {
    const requestId = Number(requestUrl.searchParams.get("requestId") || totalRequests + 1);
    const algorithm = requestUrl.searchParams.get("algorithm") || "unknown";
    const startedAt = Date.now();
    const queueDepth = activeConnections;
    const processingMs = runtimeConfig.baseDelayMs + runtimeConfig.extraDelayMs;

    activeConnections += 1;
    totalRequests += 1;
    peakActiveConnections = Math.max(peakActiveConnections, activeConnections);

    setTimeout(() => {
      activeConnections = Math.max(0, activeConnections - 1);
      completedRequests += 1;
      totalProcessingMs += processingMs;

      const finishedAt = Date.now();
      lastRequest = {
        requestId,
        algorithm,
        processingMs,
        queueDepth,
        startedAt,
        finishedAt,
      };

      history = [
        {
          requestId,
          algorithm,
          processingMs,
          queueDepth,
          startedAt,
          finishedAt,
        },
        ...history,
      ].slice(0, 12);

      sendJson(res, 200, {
        ok: true,
        requestId,
        algorithm,
        serverName,
        serverColor,
        serverIndex,
        hostname: os.hostname(),
        processingMs,
        queueDepth,
        startedAt,
        finishedAt,
        activeConnections,
        totalRequests,
      });
    }, processingMs);
    return;
  }

  notFound(res);
});

server.listen(port, () => {
  console.log(`${serverName} listening on ${port}`);
});