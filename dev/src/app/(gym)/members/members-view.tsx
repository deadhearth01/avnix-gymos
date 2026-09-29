"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, MessageCircle, WhatsApp, MoreHorizontal, ScanLine, UserPlus, UsersRound, Eye } from "@/components/icons";
import { DataTable, type Column } from "@/components/kit/data-table";
import { StatusDot, Tag } from "@/components/kit/badges";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { STATUS_META, type LiveStatus } from "@/lib/domain/membership";
import { ago, daysUntil, fmtDate, fmtPhone, inr } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { notify } from "@/lib/notify";
import { downloadCsv } from "@/lib/csv";
import { checkInAction } from "../_actions/frontdesk";
import { AddMemberSheet, type PlanOption } from "./add-member-sheet";

export type MemberRow = {
  id: string;
  code: string | null;
  name: string;
  phone: string;
  email: string | null;
  planName: string | null;
  expiresAt: string | null;
  lastVisitAt: string | null;
  visitCount: number;
  balanceDue: number;
  status: LiveStatus;
  idle: boolean;
  isNew: boolean;
  gender: string;
  lang: string;
  source: string;
  createdAt: string;
};

function exportMembers(name: string, rows: MemberRow[]) {
  downloadCsv(name, [
    ["Code", "Name", "Phone", "Email", "Plan", "Status", "Expires", "Last visit", "Visits", "Balance due"],
    ...rows.map((r) => [
      r.code,
      r.name,
      r.phone,
      r.email,
      r.planName,
      STATUS_META[r.status].label,
      r.expiresAt?.slice(0, 10),
      r.lastVisitAt?.slice(0, 10),
      r.visitCount,
      r.balanceDue,
    ]),
  ]);
}

export function MembersView({
  members,
  plans,
  gymName,
  gst,
  canEdit,
  canBill,
  openNew,
  initialStatus,
}: {
  members: MemberRow[];
  plans: PlanOption[];
  gymName: string;
  gst: { rate: number; inclusive: boolean };
  canEdit: boolean;
  canBill: boolean;
  openNew: boolean;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [sheet, setSheet] = React.useState(openNew);
  const count = (s: LiveStatus) => members.filter((m) => m.status === s).length;

  const quickCheckIn = async (m: MemberRow) => {
    const r = await checkInAction(m.id);
    if (!r.ok) return void notify.error(r.error);
    if (r.data?.blocked) notify.warning(`${m.name} has no valid plan — renew first`);
    else if (r.data?.duplicate) notify.info(`${m.name} already checked in within the last hour`);
    else notify.success(`${m.name} checked in · visit #${r.data?.visitCount}`);
  };

  const columns: Column<MemberRow>[] = [
    {
      id: "name",
      header: "Member",
      sort: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="flex items-center gap-3">
          <PersonAvatar name={r.name} size={34} />
          <div className="min-w-0">
            <Link href={`/members/${r.id}`} className="block truncate font-medium hover:underline">
              {r.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {r.code} · {fmtPhone(r.phone)}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "plan",
      header: "Plan",
      hideBelow: "md",
      sort: (r) => r.planName ?? "",
      cell: (r) => <span className="text-sm">{r.planName ?? <span className="text-muted-foreground">—</span>}</span>,
    },
    {
      id: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => (
        <StatusDot tone={STATUS_META[r.status].tone} pulse={r.status === "expiring"}>
          {STATUS_META[r.status].label}
        </StatusDot>
      ),
    },
    {
      id: "expires",
      header: "Expires",
      sort: (r) => r.expiresAt ?? "",
      hideBelow: "sm",
      cell: (r) => {
        const d = daysUntil(r.expiresAt);
        return (
          <div>
            <p className="tabular text-sm">{fmtDate(r.expiresAt)}</p>
            {d != null && (
              <p className={`text-xs ${d < 0 ? "text-danger-ink" : d <= 7 ? "text-warning-ink" : "text-muted-foreground"}`}>
                {d < 0 ? `${-d}d ago` : d === 0 ? "today" : `in ${d}d`}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "visit",
      header: "Last visit",
      hideBelow: "lg",
      sort: (r) => r.lastVisitAt ?? "",
      cell: (r) => <span className={`text-sm ${r.idle ? "text-warning-ink" : "text-muted-foreground"}`}>{ago(r.lastVisitAt)}</span>,
    },
    {
      id: "due",
      header: "Balance",
      align: "right",
      sort: (r) => r.balanceDue,
      cell: (r) =>
        r.balanceDue > 0 ? (
          <Tag tone="red" className="tabular">
            {inr(r.balanceDue)}
          </Tag>
        ) : (
          <span className="text-sm text-subtle">—</span>
        ),
    },
    {
      id: "joined",
      header: "Joined",
      hideBelow: "xl",
      sort: (r) => r.createdAt,
      cell: (r) => <span className="text-sm text-muted-foreground">{fmtDate(r.createdAt, "dd MMM yy")}</span>,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href={`/members/${r.id}`}>
                <Eye className="size-4" /> Open profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => quickCheckIn(r)}>
              <ScanLine className="size-4" /> Check in
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={waLink(r.phone, `Hi ${r.name.split(" ")[0]}, `) ?? "#"} target="_blank" rel="noreferrer">
                <WhatsApp className="size-4" /> WhatsApp
              </a>
            </DropdownMenuItem>
            {canBill && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/members/${r.id}?action=renew`}>Renew / sell plan</Link>
                </DropdownMenuItem>
                {r.balanceDue > 0 && (
                  <DropdownMenuItem asChild>
                    <Link href={`/members/${r.id}?action=collect`}>Collect {inr(r.balanceDue)}</Link>
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={members}
        columns={columns}
        getId={(r) => r.id}
        noun={["member", "members"]}
        search={(r) => `${r.name} ${r.phone} ${r.code ?? ""} ${r.email ?? ""} ${r.planName ?? ""}`}
        searchPlaceholder="Name, phone or code"
        initialSort={{ id: "joined", dir: "desc" }}
        pageSize={12}
        rowHref={(r) => `/members/${r.id}`}
        mobileCard={(r) => (
          <div className="flex items-center gap-3">
            <PersonAvatar name={r.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.planName ?? "No plan"} · {r.expiresAt ? `till ${fmtDate(r.expiresAt, "dd MMM")}` : r.code}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusDot tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</StatusDot>
              {r.balanceDue > 0 && (
                <Tag tone="red" className="tabular h-5 text-[11px]">
                  {inr(r.balanceDue)}
                </Tag>
              )}
            </div>
          </div>
        )}
        selectable
        bulkActions={(sel, clear) => (
          <>
            <Button size="xs" variant="outline" onClick={() => exportMembers(`members-${new Date().toISOString().slice(0, 10)}.csv`, sel)}>
              <Download /> Export {sel.length}
            </Button>
            <Button
              size="xs"
              variant="soft"
              onClick={() => {
                navigator.clipboard.writeText(sel.map((m) => m.phone).join(", "));
                notify.success(`${sel.length} numbers copied — paste into a WhatsApp broadcast list`);
                clear();
              }}
            >
              <MessageCircle /> Copy numbers
            </Button>
          </>
        )}
        filters={[
          {
            id: "status",
            label: "Status",
            allLabel: "All statuses",
            options: (["active", "expiring", "upcoming", "expired", "frozen", "none", "cancelled"] as LiveStatus[]).map((s) => ({
              value: s,
              label: STATUS_META[s].label,
              count: count(s),
            })),
            match: (r, v) => (v === "idle" ? r.idle : r.status === v),
          },
          {
            id: "flags",
            label: "Needs attention",
            allLabel: "Everyone",
            options: [
              { value: "due", label: "Has dues", count: members.filter((m) => m.balanceDue > 0).length },
              { value: "idle", label: "Not visiting (7d+)", count: members.filter((m) => m.idle).length },
              { value: "new", label: "Joined in last 30 days", count: members.filter((m) => m.isNew).length },
            ],
            match: (r, v) => (v === "due" ? r.balanceDue > 0 : v === "idle" ? r.idle : r.isNew),
          },
          {
            id: "plan",
            label: "Plan",
            allLabel: "All plans",
            options: [...new Set(members.map((m) => m.planName).filter(Boolean))].map((p) => ({ value: p!, label: p! })),
            match: (r, v) => r.planName === v,
          },
        ]}
        toolbar={
          <>
            <Button
              variant="outline"
              size="icon"
              aria-label="Export all as CSV"
              onClick={() => exportMembers(`members-${new Date().toISOString().slice(0, 10)}.csv`, members)}
            >
              <AnimatedIcon icon={Download} />
            </Button>
            {canEdit && (
              <Button data-tour="add-member" onClick={() => setSheet(true)}>
                <AnimatedIcon icon={UserPlus} /> Add member
              </Button>
            )}
          </>
        }
        empty={{
          icon: UsersRound,
          title: "No members yet",
          description: "Add your first member — you can sell them a plan and take payment in the same step.",
          action: canEdit ? (
            <Button onClick={() => setSheet(true)}>
              <UserPlus /> Add member
            </Button>
          ) : undefined,
        }}
        initialFilters={
          initialStatus === "idle"
            ? { flags: ["idle"] }
            : initialStatus === "due"
              ? { flags: ["due"] }
              : initialStatus
                ? { status: [initialStatus] }
                : undefined
        }
      />
      {canEdit && (
        <AddMemberSheet
          open={sheet}
          onOpenChange={(v) => {
            setSheet(v);
            if (!v && openNew) router.replace("/members");
          }}
          plans={plans}
          gst={gst}
          canBill={canBill}
          gymName={gymName}
        />
      )}
    </>
  );
}
