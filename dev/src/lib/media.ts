import { presetUrl } from "@/lib/site/presets";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "";
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "";

/** Public URL for an image in the `gym-media` bucket (public read). */
export function mediaUrl(fileId: string | null | undefined, opts: { width?: number; height?: number; quality?: number } = {}) {
  if (!fileId) return null;
  const bundled = presetUrl(fileId, (opts.width ?? 2000) <= 700 ? "sm" : "lg");
  if (bundled) return bundled;
  const base = `${ENDPOINT}/storage/buckets/gym-media/files/${encodeURIComponent(fileId)}`;
  if (!opts.width && !opts.height) return `${base}/view?project=${PROJECT}`;
  const q = new URLSearchParams({ project: PROJECT, quality: String(opts.quality ?? 80), output: "webp" });
  if (opts.width) q.set("width", String(opts.width));
  if (opts.height) q.set("height", String(opts.height));
  return `${base}/preview?${q}`;
}
