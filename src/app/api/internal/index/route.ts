import { indexWatches } from "@/lib/indexer";

export async function POST(request: Request) {
  const configured = process.env.WORKER_SECRET;
  const provided = request.headers.get("x-worker-secret");
  if (process.env.NODE_ENV === "production" && configured && provided !== configured) {
    return Response.json({ error: { title: "Not allowed." } }, { status: 401 });
  }
  const report = await indexWatches({ notify: true });
  return Response.json({ ok: true, ...report });
}
