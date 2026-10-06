import { createApiServer } from "./app.ts";

const port = Number(process.env.PORT ?? 8787);
const server = createApiServer();
server.listen(port, "0.0.0.0", () => process.stdout.write(`Beta Calendars Calendar API listening on ${port}\n`));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(() => process.exit(0)));
