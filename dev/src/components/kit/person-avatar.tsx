import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const PALETTE = [
  "bg-[#e0f2fe] text-[#075985]",
  "bg-[#dcfce7] text-[#166534]",
  "bg-[#fef3c7] text-[#92400e]",
  "bg-[#ede9fe] text-[#5b21b6]",
  "bg-[#fce7f3] text-[#9d174d]",
  "bg-[#ffedd5] text-[#9a3412]",
  "bg-[#e0e7ff] text-[#3730a3]",
  "bg-[#ccfbf1] text-[#115e59]",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function PersonAvatar({ name, src, size = 32, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className={cn("shrink-0 rounded-full object-cover ring-1 ring-black/5", className)} />;
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold ring-1 ring-black/5 dark:ring-white/10",
        PALETTE[hash(name) % PALETTE.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
