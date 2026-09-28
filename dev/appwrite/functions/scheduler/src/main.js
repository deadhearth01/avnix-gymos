/**
 * gymos-scheduler — runs every 30 minutes (Appwrite Function schedule).
 * Delegates to the app's authenticated cron endpoint so business logic
 * (journeys, Twilio delivery, AvniX billing sync) lives in one place.
 */
export default async ({ res, log, error }) => {
  const url = `${process.env.APP_URL.replace(/\/$/, "")}/api/cron/run`;
  const started = Date.now();
  try {
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, signal: AbortSignal.timeout(290_000) });
    const text = await r.text();
    (r.ok ? log : error)(`${r.status} in ${Date.now() - started}ms: ${text.slice(0, 3000)}`);
    return res.json({ ok: r.ok, status: r.status });
  } catch (e) {
    error(`scheduler failed: ${e?.message ?? e}`);
    return res.json({ ok: false }, 500);
  }
};
