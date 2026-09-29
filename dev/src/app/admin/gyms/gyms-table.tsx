"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, ExternalLink } from "@/components/icons";
import { DataTable, type Column } from "@/components/kit/data-table";
import { Tag, StatusDot } from "@/components/kit/badges";
import { BrandMark } from "@/components/shell/sidebar";
import { Switch } from "@/components/ui/switch";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { notify } from "@/lib/notify";
import { fmtDate, inr, num } from "@/lib/format";
import { setGymStatusAction } from "../actions";

export type GymRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  brandColor: string | null;
  logoUrl: string | null;
  status: "active" | "suspended" | "archived";
  ownerName: string | null;
  ownerEmail: string | null;
  plan: string;
  monthlyFee: number;
  billingMonths: number;
  subStatus: string | null;
  outstanding: number;
  members: number;
  createdAt: string;
  customDomain: string | null;
};

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "gym.avnix.in";

function AccessSwitch({ row }: { row: GymRow }) {
  const [on, setOn] = React.useState(row.status === "active");
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Switch
      checked={on}
      disabled={pending || row.status === "archived"}
      aria-label={`Access for ${row.name}`}
      onCheckedChange={(v) => {
        setOn(v);
        start(async () => {
          const r = await setGymStatusAction(row.id, v ? "active" : "suspended");
          if (!r.ok) {
            setOn(!v);
            notify.error(r.error);
          } else {
            notify.success(`${row.name}: ${v ? "access enabled" : "access paused"}`);
            router.refresh();
          }
        });
      }}
    />
  );
}

export function GymsTable({ gyms }: { gyms: GymRow[] }) {
  const columns: Column<GymRow>[] = [
    {
      id: "name",
      header: "Gym",
      sort: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="flex items-center gap-3">
          <BrandMark name={r.name} color={r.brandColor} logoUrl={r.logoUrl} seed={r.id} size={34} />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
            <p className="truncate text-xs text-muted-foreground">{r.city ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      id: "site",
      header: "Website",
      hideBelow: "lg",
      cell: (r) => {
        const host = r.customDomain ?? `${r.slug}.${ROOT}`;
        return (
          <a
            href={`https://${host}`}
            target="_blank"
            rel="noreferrer"
            className="anim-host inline-flex max-w-[220px] items-center gap-1 truncate text-[13px] text-muted-foreground hover:text-foreground"
          >
            <span className="truncate">{host}</span>
            <AnimatedIcon icon={ExternalLink} className="size-3" />
          </a>
        );
      },
    },
    {
      id: "owner",
      header: "Owner",
      hideBelow: "md",
      sort: (r) => r.ownerName?.toLowerCase() ?? "",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{r.ownerName ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{r.ownerEmail}</p>
        </div>
      ),
    },
    {
      id: "members",
      header: "Members",
      align: "right",
      hideBelow: "xl",
      sort: (r) => r.members,
      cell: (r) => <span className="tabular">{num(r.members)}</span>,
    },
    {
      id: "fee",
      header: "Plan",
      sort: (r) => r.monthlyFee,
      cell: (r) => (
        <div>
          <p className="tabular text-sm font-medium">
            {inr(r.monthlyFee)}
            <span className="text-xs font-normal text-muted-foreground">/mo</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {r.plan} · {r.billingMonths ? `${r.billingMonths} mo` : "ongoing"}
          </p>
        </div>
      ),
    },
    {
      id: "outstanding",
      header: "Outstanding",
      align: "right",
      sort: (r) => r.outstanding,
      cell: (r) =>
        r.outstanding > 0 ? (
          <Tag tone="red" className="tabular">
            {inr(r.outstanding)}
          </Tag>
        ) : (
          <Tag tone="lime">Paid up</Tag>
        ),
    },
    {
      id: "status",
      header: "Status",
      hideBelow: "sm",
      sort: (r) => r.status,
      cell: (r) => (
        <StatusDot tone={r.status === "active" ? "green" : r.status === "suspended" ? "red" : "gray"} pulse={r.status === "active"}>
          {r.status === "active" ? "Live" : r.status === "suspended" ? "Paused" : "Archived"}
        </StatusDot>
      ),
    },
    { id: "access", header: "Access", align: "center", cell: (r) => <AccessSwitch row={r} /> },
    {
      id: "created",
      header: "Created",
      hideBelow: "xl",
      sort: (r) => r.createdAt,
      cell: (r) => <span className="text-[13px] text-muted-foreground">{fmtDate(r.createdAt)}</span>,
    },
  ];

  return (
    <DataTable
      rows={gyms}
      columns={columns}
      getId={(r) => r.id}
      noun={["gym", "gyms"]}
      search={(r) => `${r.name} ${r.slug} ${r.city ?? ""} ${r.ownerName ?? ""} ${r.ownerEmail ?? ""}`}
      searchPlaceholder="Search gyms"
      initialSort={{ id: "created", dir: "desc" }}
      rowHref={(r) => `/admin/gyms/${r.id}`}
      mobileCard={(r) => (
        <div className="flex items-center gap-3">
          <BrandMark name={r.name} color={r.brandColor} logoUrl={r.logoUrl} seed={r.id} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {inr(r.monthlyFee)}/mo · {r.members} members
            </p>
          </div>
          {r.outstanding > 0 ? (
            <Tag tone="red" className="tabular">
              {inr(r.outstanding)}
            </Tag>
          ) : (
            <StatusDot tone={r.status === "active" ? "green" : "red"} />
          )}
        </div>
      )}
      filters={[
        {
          id: "status",
          label: "Status",
          allLabel: "All statuses",
          options: [
            { value: "active", label: "Live", count: gyms.filter((g) => g.status === "active").length },
            { value: "suspended", label: "Paused", count: gyms.filter((g) => g.status === "suspended").length },
          ],
          match: (r, v) => r.status === v,
        },
        {
          id: "billing",
          label: "Billing",
          allLabel: "All billing",
          options: [
            { value: "due", label: "Has outstanding" },
            { value: "clear", label: "Paid up" },
          ],
          match: (r, v) => (v === "due" ? r.outstanding > 0 : r.outstanding === 0),
        },
      ]}
      empty={{ icon: Building2, title: "No gyms yet", description: "Create your first gym to see it here." }}
    />
  );
}
