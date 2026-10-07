import { indexWatches } from "@/lib/indexer";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function allowed(request: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  const worker = process.env.WORKER_SECRET;
  const cron = process.env.CRON_SECRET;
  const provided = request.headers.get("x-worker-secret");
  const authorization = request.headers.get("authorization");
  if (worker && provided === worker) return true;
  if (cron && authorization === `Bearer ${cron}`) return true;
  return false;
}

async function run() {
  const report = await indexWatches({ notify: true });
  return Response.json({ ok: true, ...report });
}

export async function POST(request: Request) {
  if (!allowed(request)) return Response.json({ error: { title: "Not allowed." } }, { status: 401 });
  return run();
}

export async function GET(request: Request) {
  if (!allowed(request)) return Response.json({ error: { title: "Not allowed." } }, { status: 401 });
  return run();
}
