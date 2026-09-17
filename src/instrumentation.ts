export async function register() {
  // Server-side initialization
  console.log("[Instrumentation] Server runtime initialized.");
}

export async function onRequestError(
  err: Error & { digest?: string },
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    renderSource?:
      | "react-server-components"
      | "react-server-components-payload"
      | "server-rendering";
    revalidateReason?: "on-demand" | "stale-while-revalidate" | "max-age";
    renderType?: "dynamic" | "dynamic-resume";
  }
) {
  console.error("=================================================");
  console.error("[CRITICAL SERVER ERROR]");
  console.error(`Timestamp: ${new Date().toISOString()}`);
  console.error(`Path: ${request.method} ${request.path}`);
  console.error(`Route: ${context.routePath} (${context.routeType} - ${context.renderSource || ""})`);
  console.error(`Digest: ${err?.digest || "none"}`);
  console.error(`Message: ${err?.message || String(err)}`);
  console.error("Stack Trace:");
  console.error(err?.stack || "No stack trace available");
  console.error("=================================================");
}
