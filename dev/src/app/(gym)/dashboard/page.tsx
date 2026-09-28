import Link from "next/link";
import { after } from "next/server";
import { AlarmClock, CalendarClock, HeartPulse, IndianRupee, Plus, ReceiptText, ScanLine, UserPlus, UsersRound, Wallet } from "@/components/icons";
import { PageHeader, SectionTitle } from "@/components/kit/page-header";
import { StatCard } from "@/components/kit/stat-card";
import { Stagger, StaggerItem } from "@/components/kit/motion";
import { BarTrackChart } from "@/components/charts/bar-track";
import { DotHeatmap } from "@/components/charts/dot-heatmap";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { EmptyState } from "@/components/kit/empty-state";
import { Tag } from "@/components/kit/badges";
import { getGymContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { dashboardData } from "@/lib/queries/gym";
import { maybeRunJourneys } from "@/lib/services/messages";
import { ago, daysUntil, fmtDate, fmtTime, inr, pct } from "@/lib/format";
import { CheckinsTrend, DashboardLive, TodayFeed, WaButton } from "./widgets";

export const metadata = { title: "Home" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const METHOD: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank: "Bank", other: "Other" };

export default async function Dashboard() {
  const ctx = await getGymContext();
  const money = can(ctx.role, "dashboard.money");
  const d = await dashboardData(ctx.gymId);
  after(() => maybeRunJourneys(ctx.gym).catch((e) => console.error("[journeys]", e)));
  const first = (ctx.user.name || "there").split(" ")[0];
  const today = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <>
      <DashboardLive />
      <PageHeader
        title={`${greeting()}, ${first}`}
        description={`${today} · here's what's happening at ${ctx.gym.name}.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/front-desk">
                <AnimatedIcon icon={ScanLine} /> Check in
              </Link>
            </Button>
            {can(ctx.role, "members.edit") && (
              <Button asChild>
                <Link href="/members?new=1">
                  <AnimatedIcon icon={UserPlus} /> Add member
                </Link>
              </Button>
            )}
          </>
        }
      />

      <Stagger data-tour="kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StaggerItem>
          <StatCard
            icon={UsersRound}
            label="Active members"
            value={d.kpis.activeMembers}
            delta={pct(d.kpis.newThisMonth, d.kpis.newLastMonthToDate)}
            hint={`${d.kpis.newThisMonth} joined this month · ${d.kpis.totalMembers} total`}
          />
        </StaggerItem>
        <StaggerItem>
          {money ? (
            <StatCard
              icon={IndianRupee}
              label="Collected this month"
              value={d.kpis.collectedThisMonth}
              fmt="inr"
              delta={pct(d.kpis.collectedThisMonth, d.kpis.collectedLastMonthToDate)}
              hint="vs same days last month"
            />
          ) : (
            <StatCard icon={ScanLine} label="Checked in today" value={d.kpis.checkinsToday} hint={`${d.kpis.checkinsYesterday} yesterday`} />
          )}
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={Wallet}
            label="Dues outstanding"
            value={d.kpis.duesTotal}
            fmt="inr"
            hint={`${d.kpis.duesCount} member${d.kpis.duesCount === 1 ? "" : "s"} owe a balance`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={CalendarClock}
            label="Expiring in 7 days"
            value={d.kpis.expiringCount}
            hint={d.kpis.queuedMessages ? `${d.kpis.queuedMessages} reminders ready to send` : "Reminders run automatically"}
          />
        </StaggerItem>
      </Stagger>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {money ? (
          <div data-tour="revenue" className="surface p-5">
            <SectionTitle action={<span className="text-[13px] text-muted-foreground">Last 12 months</span>}>Revenue</SectionTitle>
            <BarTrackChart
              data={d.months.map((m) => ({ label: m.label, value: m.revenue, sub: `${m.newMembers} new members` }))}
              fmt="inrCompact"
              height={250}
            />
          </div>
        ) : (
          <CheckinsTrend weekly={d.checkins.weekly} monthly={d.checkins.monthly} yearly={d.checkins.yearly} />
        )}
        <TodayFeed
          initial={d.today.map((c) => ({ id: c.$id, name: c.memberName, at: c.at }))}
          total={d.kpis.checkinsToday}
          yesterday={d.kpis.checkinsYesterday}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {money && <CheckinsTrend weekly={d.checkins.weekly} monthly={d.checkins.monthly} yearly={d.checkins.yearly} />}
        <div className="surface p-5">
          <SectionTitle action={<span className="text-[13px] text-muted-foreground">Last 12 weeks</span>}>Attendance activity</SectionTitle>
          <DotHeatmap
            cells={d.heatmap}
            columns={12}
            rowLabels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
            colLabels={["W1", "", "W3", "", "W5", "", "W7", "", "W9", "", "W11", "Now"]}
          />
          <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-subtle">
            Less
            {[0.18, 0.4, 0.62, 0.85, 1].map((o) => (
              <span key={o} className="size-2.5 rounded-[3px]" style={{ background: `rgb(124 58 237 / ${o})` }} />
            ))}
            More
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ListCard title="Expiring soon" icon={AlarmClock} empty="No renewals due this week." href="/members?status=expiring">
          {d.expiring.map((m) => {
            const days = daysUntil(m.expiresAt) ?? 0;
            return (
              <Row
                key={m.$id}
                href={`/members/${m.$id}`}
                name={m.name}
                sub={`${m.planName ?? "Plan"} · ${days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`}
              >
                <WaButton
                  phone={m.phone}
                  text={`Hi ${m.name.split(" ")[0]}, your ${m.planName ?? "membership"} at ${ctx.gym.name} ends on ${fmtDate(m.expiresAt)}. Shall we renew it for you? 💪`}
                  label="Remind"
                />
              </Row>
            );
          })}
        </ListCard>
        <ListCard title="At risk · not visiting" icon={HeartPulse} empty="Everyone's showing up. 🔥" href="/members?status=idle">
          {d.idle.map((m) => (
            <Row key={m.$id} href={`/members/${m.$id}`} name={m.name} sub={`Last visit ${ago(m.lastVisitAt)}`}>
              <WaButton
                phone={m.phone}
                text={`Hey ${m.name.split(" ")[0]}, we've missed you at ${ctx.gym.name}! See you at the gym this week? 💪`}
                label="Nudge"
              />
            </Row>
          ))}
        </ListCard>
        <ListCard title="Dues to collect" icon={Wallet} empty="No pending dues. 🎉" href="/billing?tab=dues">
          {d.dues.map((m) => (
            <Row key={m.$id} href={`/members/${m.$id}`} name={m.name} sub={m.planName ?? "—"}>
              <Tag tone="red" className="tabular">
                {inr(m.balanceDue)}
              </Tag>
            </Row>
          ))}
        </ListCard>
      </div>

      {money && (
        <div className="surface mt-4 overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-[15px] font-semibold">Recent payments</h2>
            <Link href="/billing?tab=payments" className="text-[13px] text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {d.recentPayments.length === 0 ? (
            <EmptyState
              compact
              icon={ReceiptText}
              title="No payments yet"
              description="Sell a plan or collect dues from a member's profile."
              action={
                <Button size="sm" asChild>
                  <Link href="/members?new=1">
                    <AnimatedIcon icon={Plus} /> Add member
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-muted/55 text-left text-[13px] text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Member</th>
                    <th className="px-5 py-2.5 font-medium">Invoice</th>
                    <th className="px-5 py-2.5 font-medium">Method</th>
                    <th className="px-5 py-2.5 font-medium">When</th>
                    <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentPayments.map((p) => (
                    <tr key={p.$id} className="border-t transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <Link href={`/members/${p.memberId}`} className="flex items-center gap-2.5 font-medium hover:underline">
                          <PersonAvatar name={p.memberName} size={28} /> {p.memberName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{p.invoiceNumber ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Tag tone={p.method === "upi" ? "violet" : p.method === "cash" ? "lime" : "blue"}>{METHOD[p.method]}</Tag>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {fmtDate(p.paidAt, "dd MMM")} · {fmtTime(p.paidAt)}
                      </td>
                      <td className="tabular px-5 py-3 text-right font-semibold">{inr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ListCard({ title, icon, empty, href, children }: { title: string; icon: typeof Wallet; empty: string; href: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className="surface flex flex-col p-5">
      <SectionTitle
        action={
          <Link href={href} className="text-[13px] text-muted-foreground hover:text-foreground">
            View all
          </Link>
        }
      >
        <span className="anim-host inline-flex items-center gap-2">
          <AnimatedIcon icon={icon} className="size-4 text-muted-foreground" /> {title}
        </span>
      </SectionTitle>
      {items.filter(Boolean).length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="-mx-2 flex flex-col">{children}</ul>
      )}
    </div>
  );
}

function Row({ href, name, sub, children }: { href: string; name: string; sub: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <PersonAvatar name={name} size={32} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{sub}</span>
        </span>
      </Link>
      {children}
    </li>
  );
}
