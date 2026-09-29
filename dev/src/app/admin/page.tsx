import Link from "next/link";
import { Building2, CircleAlert, IndianRupee, Plus, TrendingUp, Wallet } from "@/components/icons";
import { PageHeader, SectionTitle } from "@/components/kit/page-header";
import { StatCard } from "@/components/kit/stat-card";
import { Stagger, StaggerItem } from "@/components/kit/motion";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { BarTrackChart } from "@/components/charts/bar-track";
import { Tag, StatusDot } from "@/components/kit/badges";
import { BrandMark } from "@/components/shell/sidebar";
import { mediaUrl } from "@/lib/media";
import { EmptyState } from "@/components/kit/empty-state";
import { adminOverview } from "@/lib/queries/admin";
import { ago, fmtDate, inr, pct } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const d = await adminOverview();
  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Every gym on GymOS, what they pay, and what needs your attention today."
        actions={
          <Button asChild>
            <Link href="/admin/gyms/new">
              <AnimatedIcon icon={Plus} /> New gym
            </Link>
          </Button>
        }
      />
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StaggerItem>
          <StatCard icon={Building2} label="Active gyms" value={d.activeGyms} hint={`${d.totalGyms} total · ${d.newThisMonth} new this month`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={TrendingUp} label="Monthly recurring" value={d.mrr} fmt="inr" hint={`${inr(d.arr)} annualised`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={IndianRupee}
            label="Collected this month"
            value={d.collectedThisMonth}
            fmt="inr"
            delta={pct(d.collectedThisMonth, d.collectedLastMonth)}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={Wallet} label="Outstanding" value={d.outstanding} fmt="inr" hint={`${d.overdueCount} overdue · ${d.setupPending} setup fees due`} />
        </StaggerItem>
      </Stagger>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="surface p-5">
          <SectionTitle>Collections · last 12 months</SectionTitle>
          <BarTrackChart data={d.months.map((m) => ({ label: m.label, value: m.collected, sub: `Billed ${inr(m.billed)}` }))} fmt="inrCompact" height={240} />
        </div>
        <div className="surface flex flex-col p-5">
          <SectionTitle
            action={
              <Link href="/admin/billing" className="text-[13px] text-muted-foreground hover:text-foreground">
                View all
              </Link>
            }
          >
            Overdue invoices
          </SectionTitle>
          {d.overdue.length === 0 ? (
            <EmptyState compact icon={CircleAlert} title="Nothing overdue" description="Every gym is paid up. Nice." />
          ) : (
            <ul className="-mx-2 flex flex-col">
              {d.overdue.map((inv) => (
                <li key={inv.$id}>
                  <Link
                    href={`/admin/gyms/${inv.gymId}?tab=billing`}
                    className="anim-host flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted"
                  >
                    <BrandMark name={inv.gymName} seed={inv.gymId} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{inv.gymName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {inv.number} · due {fmtDate(inv.dueAt)}
                      </span>
                    </span>
                    <Tag tone="red">{inr(inv.total)}</Tag>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="surface mt-4 p-5">
        <SectionTitle
          action={
            <Link href="/admin/gyms" className="text-[13px] text-muted-foreground hover:text-foreground">
              All gyms
            </Link>
          }
        >
          Recently added
        </SectionTitle>
        {d.recentGyms.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No gyms yet"
            description="Create the first gym — it gets its own dashboard, login and website in under a minute."
            action={
              <Button asChild>
                <Link href="/admin/gyms/new">
                  <AnimatedIcon icon={Plus} /> Create a gym
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.recentGyms.map((g) => (
              <Link
                key={g.$id}
                href={`/admin/gyms/${g.$id}`}
                className="anim-host flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]"
              >
                <BrandMark name={g.name} color={g.brandColor} logoUrl={mediaUrl(g.logoFileId, { width: 96, height: 96 })} seed={g.$id} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{g.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {g.slug}.gym.avnix.in · {ago(g.$createdAt)}
                  </span>
                </span>
                <StatusDot tone={g.status === "active" ? "green" : g.status === "suspended" ? "red" : "gray"} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
