const STORAGE_KEY = "shelf-offline-queue";
const MAX_QUEUE_SIZE = 200;

type QueuedRequest = {
  id: string;
  url: string;
  method: string;
  body: string;
};

function readQueue(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — nothing more we
    // can do locally; the request is simply lost, same as before this existed.
  }
}

function enqueue(request: Omit<QueuedRequest, "id">, dedupe: boolean) {
  const existing = readQueue();
  const kept = dedupe
    ? existing.filter((item) => !(item.url === request.url && item.method === request.method))
    : existing;
  writeQueue([...kept, { ...request, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }]);
}

// Sends a request now; if it can't reach the server (offline), queues it for
// retry instead of silently losing it — e.g. a reading session logged with
// no signal shouldn't just vanish from your stats.
//
// Set `dedupe` for requests where only the latest matters (like a debounced
// progress update) so a long offline session doesn't fill the queue with
// stale intermediate states — it replaces any already-queued request to the
// same URL/method instead of piling on. Leave it off for requests that are
// each their own distinct event (like a reading session) and must all survive.
export async function sendOrQueue(
  url: string,
  method: string,
  body: unknown,
  options: { dedupe?: boolean } = {}
) {
  const payload = JSON.stringify(body);
  try {
    return await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    enqueue({ url, method, body: payload }, options.dedupe ?? false);
    return null;
  }
}

let isFlushing = false;

// Replays queued requests in the order they were created — important for
// reading sessions, since the streak calculation compares each one against
// "yesterday" relative to whichever one was applied last.
export async function flushOfflineQueue() {
  if (isFlushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  isFlushing = true;
  try {
    const queue = readQueue();
    if (queue.length === 0) return;

    const remaining: QueuedRequest[] = [];
    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json" },
          body: item.body,
        });
        if (!response.ok) continue; // server reachable but rejected it — drop, don't retry forever
      } catch {
        remaining.push(item);
      }
    }
    writeQueue(remaining);
  } finally {
    isFlushing = false;
  }
}
