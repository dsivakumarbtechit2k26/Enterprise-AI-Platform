import http from "node:http";
import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { HealthCheckResponse } from "@workspace/api-zod";

const LARAVEL_TARGET = "http://127.0.0.1:8000";
const VITE_PORT = process.env["PLATFORM_WEB_DEV_PORT"] ?? "22597";
const VITE_TARGET = `http://127.0.0.1:${VITE_PORT}`;

/**
 * Create a transparent HTTP reverse-proxy handler that forwards the request
 * (including the full original path and all headers) to a target origin.
 *
 * Body-parsing middleware must NOT run before this handler — if the request
 * stream has already been consumed the proxy will silently send an empty body.
 */
function makeProxy(targetBase: string) {
  const parsed = new URL(targetBase);
  const hostname = parsed.hostname;
  const port = parseInt(parsed.port, 10) || (parsed.protocol === "https:" ? 443 : 80);

  return function proxyHandler(req: express.Request, res: express.Response): void {
    const proxyReq = http.request(
      {
        hostname,
        port,
        path: req.originalUrl,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(
          proxyRes.statusCode ?? 502,
          proxyRes.headers as Record<string, string | string[]>,
        );
        proxyRes.pipe(res, { end: true });
      },
    );

    proxyReq.on("error", (err) => {
      logger.warn({ err, target: targetBase, path: req.originalUrl }, "Proxy connection error");
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            message: "Backend unavailable",
            target: targetBase,
            detail: (err as NodeJS.ErrnoException).code,
          }),
        );
      }
    });

    req.pipe(proxyReq, { end: true });
  };
}

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.get("/api/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

app.use("/api", makeProxy(LARAVEL_TARGET));

app.use("/", makeProxy(VITE_TARGET));

export default app;
