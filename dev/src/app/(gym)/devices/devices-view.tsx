"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Fingerprint, MoreHorizontal, Plug, Plus, ScanFace, Webcam, type IconComponent } from "@/components/icons";
import { Field } from "@/components/forms/field";
import { Tag, type Tone } from "@/components/kit/badges";
import { useConfirm } from "@/components/kit/confirm";
import { EmptyState } from "@/components/kit/empty-state";
import { PageHeader, SectionTitle } from "@/components/kit/page-header";
import { useLiveRefresh } from "@/components/realtime/realtime-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import { notify } from "@/lib/notify";
import { createDeviceAction, deleteDeviceAction, rotateDeviceTokenAction, updateDeviceAction } from "../_actions/devices";

type Vendor = "zkteco" | "hikvision" | "generic" | "kiosk";
type DeviceRow = {
  id: string;
  name: string;
  vendor: Vendor;
  serial: string | null;
  enabled: boolean;
  lastSeenAt: string | null;
  lastPunchAt: string | null;
  lastIp: string | null;
  punchCount: number;
  model: string | null;
};
type PunchRow = {
  id: string;
  deviceName: string | null;
  userId: string;
  at: string;
  method: string;
  result: "checked_in" | "duplicate" | "blocked" | "unknown" | "ignored";
  memberId: string | null;
  memberName: string | null;
  note: string | null;
};

const VENDORS: Record<Exclude<Vendor, "kiosk">, { title: string; brands: string; body: string; icon: IconComponent }> = {
  zkteco: {
    title: "Fingerprint / face terminal",
    brands: "eSSL, ZKTeco, Realtime, BioMax, Identix",
    body: "Uses the device’s built-in “Cloud server” (ADMS) setting. Punches arrive in seconds.",
    icon: Fingerprint,
  },
  hikvision: {
    title: "Face recognition terminal",
    brands: "Hikvision, Hikvision-OEM (Prama, CP Plus)",
    body: "Uses HTTP listening on the terminal. Face, fingerprint and card events.",
    icon: ScanFace,
  },
  generic: {
    title: "Any other device",
    brands: "Matrix, Suprema, USB scanners via a bridge, scripts",
    body: "Sends punches to a secure webhook with a device key.",
    icon: Plug,
  },
};

const RESULT: Record<PunchRow["result"], { label: string; tone: Tone }> = {
  checked_in: { label: "Checked in", tone: "green" },
  duplicate: { label: "Already in", tone: "gray" },
  blocked: { label: "Blocked", tone: "amber" },
  unknown: { label: "Unknown ID", tone: "red" },
  ignored: { label: "Ignored", tone: "gray" },
};

const METHOD: Record<string, string> = {
  fingerprint: "Fingerprint",
  face: "Face",
  card: "Card",
  biometric: "Biometric",
  kiosk: "Kiosk",
  qr: "QR",
  manual: "Desk",
};

function subscribeMinute(cb: () => void) {
  const id = window.setInterval(cb, 30_000);
  return () => window.clearInterval(id);
}
function useNow() {
  return React.useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => 0,
  );
}
function ago(iso: string | null, now: number) {
  if (!iso) return "Never";
  if (!now) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
const timeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function DevicesView({ devices, punches, facesEnrolled, root }: { devices: DeviceRow[]; punches: PunchRow[]; facesEnrolled: number; root: string }) {
  useLiveRefresh(["punches"]);
  const router = useRouter();
  const confirm = useConfirm();
  const now = useNow();
  const [adding, setAdding] = React.useState(false);
  const [secret, setSecret] = React.useState<{ vendor: Vendor; name: string; token: string | null; serial?: string } | null>(null);

  async function toggle(d: DeviceRow) {
    const r = await updateDeviceAction(d.id, { enabled: !d.enabled });
    if (r.ok) router.refresh();
    else notify.error(r.error);
  }
  async function rotate(d: DeviceRow) {
    const ok = await confirm({
      title: `Create a new key for ${d.name}?`,
      description: "The old key stops working immediately. You’ll need to update it on the device.",
      confirmLabel: "Create new key",
    });
    if (!ok) return;
    const r = await rotateDeviceTokenAction(d.id);
    if (r.ok) setSecret({ vendor: d.vendor, name: d.name, token: r.data!.token });
    else notify.error(r.error);
  }
  async function remove(d: DeviceRow) {
    const ok = await confirm({
      title: `Remove ${d.name}?`,
      description: "Punches from this device will stop being counted. Past check-ins are kept.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    const r = await deleteDeviceAction(d.id);
    if (r.ok) router.refresh();
    else notify.error(r.error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance devices"
        description="Fingerprint and face attendance from the devices you already have — or any camera."
        crumbs={[{ label: "Front desk", href: "/front-desk" }, { label: "Devices" }]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/kiosk">
                <ScanFace /> Open face kiosk
              </Link>
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus /> Add device
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="surface relative overflow-hidden p-5">
          <div aria-hidden className="absolute -top-16 -right-16 size-44 rounded-full bg-primary/12 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Webcam className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Face ID kiosk</p>
              <p className="text-sm text-muted-foreground">Any laptop, tablet or USB camera</p>
            </div>
          </div>
          <dl className="relative mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Faces enrolled</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{facesEnrolled}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">How to enrol</dt>
              <dd className="mt-0.5 text-sm">Member profile → Face ID</dd>
            </div>
          </dl>
          <Button asChild variant="soft" className="relative mt-5 w-full">
            <Link href="/kiosk">Open kiosk on this screen</Link>
          </Button>
        </div>

        {devices.map((d) => {
          const v = VENDORS[d.vendor as keyof typeof VENDORS] ?? VENDORS.generic;
          const online = !!d.lastSeenAt && now > 0 && now - new Date(d.lastSeenAt).getTime() < 5 * 60_000;
          return (
            <div key={d.id} className={cn("surface p-5", !d.enabled && "opacity-60")}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                  <v.icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{d.model ?? v.brands.split(",")[0]}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Options for ${d.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void toggle(d)}>{d.enabled ? "Pause device" : "Resume device"}</DropdownMenuItem>
                    {d.vendor !== "zkteco" && <DropdownMenuItem onSelect={() => void rotate(d)}>Create a new device key</DropdownMenuItem>}
                    {d.vendor === "zkteco" && (
                      <DropdownMenuItem onSelect={() => setSecret({ vendor: d.vendor, name: d.name, token: null, serial: d.serial ?? undefined })}>
                        Setup steps
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => void remove(d)}>
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    !d.enabled ? "bg-muted-foreground" : online ? "bg-success shadow-[0_0_0_3px_var(--success-soft)]" : "bg-warning",
                  )}
                />
                <span className="font-medium">{!d.enabled ? "Paused" : online ? "Online" : d.lastSeenAt ? "Offline" : "Waiting for first contact"}</span>
                <span className="text-muted-foreground">· seen {ago(d.lastSeenAt, now).toLowerCase()}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Last punch</dt>
                  <dd className="mt-0.5">{ago(d.lastPunchAt, now)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{d.serial ? "Serial number" : "Punches"}</dt>
                  <dd className="mt-0.5 truncate font-mono text-[13px]">{d.serial ?? d.punchCount}</dd>
                </div>
              </dl>
            </div>
          );
        })}

        {devices.length === 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="grid min-h-48 place-items-center rounded-2xl border-2 border-dashed p-5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <span>
              <Fingerprint className="mx-auto size-8" />
              <span className="mt-2 block font-medium text-foreground">Connect your fingerprint or face machine</span>
              <span className="mt-1 block">eSSL, ZKTeco, Realtime, Hikvision and more</span>
            </span>
          </button>
        )}
      </div>

      <div className="surface p-5">
        <SectionTitle action={<span className="text-[13px] text-muted-foreground">Live</span>}>Recent punches</SectionTitle>
        {punches.length === 0 ? (
          <EmptyState
            compact
            icon={Fingerprint}
            title="No punches yet"
            description="When a member scans a finger or face on a connected device, it shows up here instantly."
          />
        ) : (
          <div className="-mx-2 mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Time</th>
                  <th className="px-2 py-2 font-medium">Member</th>
                  <th className="px-2 py-2 font-medium">Method</th>
                  <th className="px-2 py-2 font-medium">Device</th>
                  <th className="px-2 py-2 text-right font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {punches.map((p) => (
                  <tr key={p.id}>
                    <td className="px-2 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums">
                      {timeFmt.format(new Date(p.at)).replace("Sept", "Sep")}
                    </td>
                    <td className="px-2 py-2.5">
                      {p.memberId ? (
                        <Link href={`/members/${p.memberId}`} className="font-medium hover:underline">
                          {p.memberName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Device user {p.userId}</span>
                      )}
                      {p.note && <span className="ml-2 text-xs text-muted-foreground">{p.note}</span>}
                    </td>
                    <td className="px-2 py-2.5">{METHOD[p.method] ?? p.method}</td>
                    <td className="px-2 py-2.5 text-muted-foreground">{p.deviceName ?? "—"}</td>
                    <td className="px-2 py-2.5 text-right">
                      <Tag tone={RESULT[p.result].tone}>{RESULT[p.result].label}</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddDevice
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(s) => {
          setAdding(false);
          setSecret(s);
          router.refresh();
        }}
      />
      <SetupSteps data={secret} root={root} onClose={() => setSecret(null)} />
    </div>
  );
}

function AddDevice({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (s: { vendor: Vendor; name: string; token: string | null; serial?: string }) => void;
}) {
  const [vendor, setVendor] = React.useState<keyof typeof VENDORS>("zkteco");
  const [name, setName] = React.useState("");
  const [serial, setSerial] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, start] = React.useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createDeviceAction({
        name: name || `${VENDORS[vendor].brands.split(",")[0]} device`,
        vendor,
        serial: vendor === "zkteco" ? serial : undefined,
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        return void notify.error(r.error);
      }
      onCreated({ vendor, name: name || "Device", token: r.data!.token, serial: serial.toUpperCase() });
      setName("");
      setSerial("");
    });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add an attendance device</DialogTitle>
          <DialogDescription>Pick the kind of machine. Members use their member number as the user ID on the device.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div role="radiogroup" aria-label="Device type" className="grid gap-2">
            {(Object.keys(VENDORS) as (keyof typeof VENDORS)[]).map((k) => {
              const v = VENDORS[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={vendor === k}
                  onClick={() => setVendor(k)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-[border-color,box-shadow]",
                    vendor === k ? "border-primary ring-3 ring-primary/15" : "hover:border-foreground/25",
                  )}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", vendor === k ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    <v.icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{v.title}</span>
                    <span className="block text-xs text-muted-foreground">{v.brands}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{v.body}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <Field label="Name" hint="Where it is, so staff recognise it." error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Entrance machine" maxLength={128} />
          </Field>
          {vendor === "zkteco" && (
            <Field label="Serial number" required hint="On the device: Menu → System info → Device info → Serial number." error={errors.serial}>
              <Input
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
                placeholder="e.g. CQUJ224760012"
                className="font-mono uppercase"
                maxLength={64}
              />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Add device
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CopyRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pr-1.5 pl-3">
        <code className={cn("min-w-0 flex-1 text-[13px] break-all", secret && "font-semibold")}>{value}</code>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => {});
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

function SetupSteps({
  data,
  root,
  onClose,
}: {
  data: { vendor: Vendor; name: string; token: string | null; serial?: string } | null;
  root: string;
  onClose: () => void;
}) {
  const hikUrl = data?.token ? `https://${root}/api/devices/hik/${data.token}` : "";
  return (
    <Dialog open={!!data} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Connect {data?.name}</DialogTitle>
          <DialogDescription>
            {data?.token ? "The device key is shown only once. Copy it now." : "Do this once on the machine. It keeps working after restarts."}
          </DialogDescription>
        </DialogHeader>
        {data?.vendor === "zkteco" && (
          <ol className="grid gap-4 text-sm">
            <Step n={1} title="Open the cloud server setting">
              On the device: <b>Menu → Comm. → Cloud Server Setting</b> (on some eSSL models: <b>Comm → ADMS</b>).
            </Step>
            <Step n={2} title="Enter the GymOS server">
              <div className="mt-2 grid gap-2">
                <CopyRow label="Server address (turn on “Enable domain name”)" value={root} />
                <CopyRow label="Server port" value="443" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Turn on HTTPS if the menu has it. Older models without HTTPS: use port 80 and ask AvniX support to enable plain-HTTP for your device.
              </p>
            </Step>
            <Step n={3} title="Enrol members with their member number">
              Add each member on the device with <b>User ID = the number in their member code</b> (M0140 → <b>140</b>), then register their finger or face.
            </Step>
            <Step n={4} title="Check it’s connected">
              Within a minute this device shows <b>Online</b>. Punches appear under Recent punches.
            </Step>
          </ol>
        )}
        {data?.vendor === "hikvision" && data.token && (
          <ol className="grid gap-4 text-sm">
            <Step n={1} title="Open HTTP listening">
              In the terminal’s web page: <b>Configuration → Network → Advanced → HTTP Listening</b> (or <b>Event → Alarm server</b>).
            </Step>
            <Step n={2} title="Paste this address">
              <div className="mt-2">
                <CopyRow label="Destination URL" value={hikUrl} secret />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Protocol HTTPS, port 443. The long key at the end is the password for this device — keep it private.
              </p>
            </Step>
            <Step n={3} title="Use member numbers as Employee No.">
              Add people with <b>Employee No. = member number</b> (M0140 → <b>140</b>) and capture their face.
            </Step>
          </ol>
        )}
        {data?.vendor === "generic" && data.token && (
          <div className="grid gap-3 text-sm">
            <CopyRow label="Endpoint" value={`https://${root}/api/devices/punch`} />
            <CopyRow label="Device key (Authorization: Bearer …)" value={data.token} secret />
            <CopyRow
              label="Example"
              value={`curl -X POST https://${root}/api/devices/punch -H "Authorization: Bearer ${data.token}" -H "Content-Type: application/json" -d '{"userId":"140","method":"fingerprint"}'`}
            />
            <p className="text-xs text-muted-foreground">
              Send the member number (140) or member code (M0140). Batches of up to 500 punches are accepted as {'{ "punches": [ … ] }'}.
            </p>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[28px_1fr] gap-3">
      <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{n}</span>
      <div>
        <p className="font-medium">{title}</p>
        <div className="mt-0.5 text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}
