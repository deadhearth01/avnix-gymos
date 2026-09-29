"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw, ScanFace, Search, Trash2, TriangleAlert } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusDot } from "@/components/kit/badges";
import { EmptyState } from "@/components/kit/empty-state";
import { Segmented } from "@/components/kit/segmented";
import { useConfirm } from "@/components/kit/confirm";
import { FaceEnrollDialog } from "@/components/face/face-enroll";
import { STATUS_META } from "@/lib/domain/membership";
import { fmtDateTime, initials } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { FaceIdRow } from "@/lib/queries/gym";
import { cn } from "@/lib/utils";

type Filter = "all" | "used" | "unused" | "rescan";

const photoUrl = (r: FaceIdRow) => (r.photo ? `/api/face/photo/${encodeURIComponent(r.memberId)}?v=${encodeURIComponent(r.photo)}` : null);

export function FaceIdsView({ rows, canEdit }: { rows: FaceIdRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const rescan = rows.filter((r) => r.outdated || !r.photo).length;
  const used = rows.filter((r) => r.faceCheckins > 0).length;
  const list = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "used" && !r.faceCheckins) return false;
      if (filter === "unused" && r.faceCheckins) return false;
      if (filter === "rescan" && !(r.outdated || !r.photo)) return false;
      return !term || r.name.toLowerCase().includes(term) || (r.code ?? "").toLowerCase().includes(term);
    });
  }, [rows, q, filter]);

  if (!rows.length)
    return (
      <EmptyState
        icon={ScanFace}
        title="No Face IDs yet"
        description="Open a member’s profile and choose Set up Face ID from the ⋯ menu. Their photo shows up here for checking."
        action={
          <Button asChild variant="outline">
            <Link href="/members">Go to members</Link>
          </Button>
        }
      />
    );

  const index = openId ? list.findIndex((r) => r.memberId === openId) : -1;
  const open = index >= 0 ? list[index] : null;

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? "member has" : "members have"} Face ID. {used} checked in with it in the last 30 days
        {rescan ? `, and ${rescan} need a new scan.` : "."}
      </p>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or member no." className="pl-9" aria-label="Search Face IDs" />
        </div>
        <Segmented
          layoutId="face-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "used", label: "Used this month" },
            { value: "unused", label: "Not used" },
            ...(rescan ? [{ value: "rescan" as const, label: "Needs new scan" }] : []),
          ]}
        />
      </div>

      {list.length ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {list.map((r) => (
            <li key={r.memberId}>
              <button
                type="button"
                onClick={() => setOpenId(r.memberId)}
                className="group w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`View ${r.name}’s Face ID`}
              >
                <FacePhoto row={r} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
                <p className="mt-2.5 truncate text-sm font-semibold">{r.name}</p>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium tabular-nums">{r.code ?? "—"}</span>
                  <span className="truncate">{r.faceCheckins ? `${r.faceCheckins} check-in${r.faceCheckins === 1 ? "" : "s"}` : "Not used yet"}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={Search} title="No one matches" description="Try another name or member number, or pick All." />
      )}

      <FaceIdDialog
        row={open}
        canEdit={canEdit}
        onClose={() => setOpenId(null)}
        onPrev={index > 0 ? () => setOpenId(list[index - 1].memberId) : undefined}
        onNext={index >= 0 && index < list.length - 1 ? () => setOpenId(list[index + 1].memberId) : undefined}
        onChanged={() => router.refresh()}
      />
    </>
  );
}

function FacePhoto({ row, className, large = false }: { row: FaceIdRow; className?: string; large?: boolean }) {
  const src = photoUrl(row);
  const [failed, setFailed] = React.useState(false);
  return (
    <div className={cn("relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted ring-1 ring-border", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${row.name}’s Face ID photo`} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-b from-muted to-muted/40">
          <div className="text-center">
            <span
              className={cn(
                "mx-auto grid place-items-center rounded-full bg-background font-semibold text-muted-foreground",
                large ? "size-24 text-3xl" : "size-14 text-lg",
              )}
            >
              {initials(row.name)}
            </span>
            <p className={cn("mt-2 text-muted-foreground", large ? "text-sm" : "text-[11px]")}>No photo saved</p>
          </div>
        </div>
      )}
      {row.outdated && (
        <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-lg bg-warning px-2 py-1 text-[11px] font-semibold text-black/85">
          <TriangleAlert className="size-3.5" /> Needs a new scan
        </span>
      )}
    </div>
  );
}

function FaceIdDialog({
  row,
  canEdit,
  onClose,
  onPrev,
  onNext,
  onChanged,
}: {
  row: FaceIdRow | null;
  canEdit: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const [scan, setScan] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const first = row?.name.split(" ")[0] ?? "";

  const remove = async () => {
    if (!row) return;
    const ok = await confirm({
      title: `Delete ${first}’s Face ID?`,
      description: "Their face signature and reference photo are deleted. They check in at the desk until you scan them again.",
      confirmLabel: "Delete Face ID",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/face/enroll?memberId=${encodeURIComponent(row.memberId)}`, { method: "DELETE" });
      const r = (await res.json()) as { ok: boolean; error?: string };
      if (!r.ok) return void notify.error(r.error ?? "Couldn’t delete Face ID.");
      notify.success("Face ID deleted");
      onClose();
      onChanged();
    } catch {
      notify.error("Couldn’t reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={!!row && !scan} onOpenChange={(v) => !v && onClose()}>
        {row && (
          <DialogContent
            className="max-h-[94dvh] overflow-y-auto p-0 sm:max-w-3xl"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" && onPrev) onPrev();
              if (e.key === "ArrowRight" && onNext) onNext();
            }}
          >
            <div className="grid sm:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="bg-muted/40 p-4 sm:p-5">
                <FacePhoto row={row} large className="shadow-[var(--shadow-float)]" />
                <div className="mt-3 flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={onPrev} disabled={!onPrev} aria-label="Previous member">
                    <ChevronLeft /> Previous
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onNext} disabled={!onNext} aria-label="Next member">
                    Next <ChevronRight />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col p-5 sm:p-6">
                <DialogTitle className="pr-8 text-xl">{row.name}</DialogTitle>
                <DialogDescription className="mt-1 flex items-center gap-3">
                  <span className="font-medium text-foreground tabular-nums">{row.code ?? "No member no."}</span>
                  <StatusDot tone={STATUS_META[row.status].tone}>{STATUS_META[row.status].label}</StatusDot>
                </DialogDescription>

                <dl className="mt-5 grid gap-3 text-sm">
                  <Detail label="Face ID saved" value={fmtDateTime(row.enrolledAt)} />
                  <Detail label="Saved by" value={row.enrolledBy ?? "—"} />
                  <Detail label="Consent" value="Given at enrolment" />
                  <Detail label="Face ID check-ins, 30 days" value={String(row.faceCheckins)} />
                  <Detail label="Last Face ID check-in" value={row.lastFaceAt ? fmtDateTime(row.lastFaceAt) : "Not used yet"} />
                </dl>

                {(row.outdated || !row.photo) && (
                  <p className="mt-5 flex gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-ink">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    {row.outdated
                      ? `Saved with the older face engine. The kiosk won’t recognise ${first} until you scan again.`
                      : `No reference photo — this Face ID was saved before photos were kept. Scan again to add one.`}
                  </p>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Does the photo match the member standing in front of you? If not, delete this Face ID and scan the right person.
                </p>

                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/members/${row.memberId}`}>
                      <ExternalLink /> Open profile
                    </Link>
                  </Button>
                  {canEdit && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setScan(true)} disabled={busy}>
                        <RefreshCw /> Scan again
                      </Button>
                      <Button variant="destructive-soft" size="sm" onClick={() => void remove()} loading={busy}>
                        <Trash2 /> Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
      {row && canEdit && (
        <FaceEnrollDialog
          open={scan}
          onClose={() => setScan(false)}
          memberId={row.memberId}
          memberName={row.name}
          enrolled
          onDone={(enrolled) => {
            if (!enrolled) onClose();
            onChanged();
          }}
        />
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed pb-2.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
