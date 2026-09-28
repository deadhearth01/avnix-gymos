"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Plus, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/kit/page-header";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { DataTable, type Column } from "@/components/kit/data-table";
import { Tag } from "@/components/kit/badges";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { useConfirm } from "@/components/kit/confirm";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CredentialsReveal, type RevealData } from "@/app/admin/gyms/credentials-reveal";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { notify } from "@/lib/notify";
import { fmtDate } from "@/lib/format";
import type { StaffRole } from "@/lib/types";
import { addStaffAction, updateStaffRoleAction, removeStaffAction, resetStaffPasswordAction } from "../_actions/staff";

type Member = { id: string; userId: string; name: string; email: string; role: StaffRole; joined: string; confirmed: boolean };
const roles: StaffRole[] = ["owner", "manager", "frontdesk", "trainer"];
const editableRoles: StaffRole[] = ["manager", "frontdesk", "trainer"];
const groups = [
  { label: "Members", caps: ["dashboard.view", "members.view", "members.edit", "members.delete"] },
  { label: "Plans & billing", caps: ["plans.view", "plans.manage", "billing.view", "billing.collect", "billing.void"] },
  { label: "Daily work", caps: ["checkins.create", "leads.view", "leads.edit", "messages.send"] },
  {
    label: "Management",
    caps: [
      "dashboard.money",
      "finance.view",
      "finance.edit",
      "automations.view",
      "automations.manage",
      "website.manage",
      "audit.view",
      "settings.manage",
      "staff.manage",
    ],
  },
];
const capLabel: Record<string, string> = {
  "dashboard.view": "View dashboard",
  "members.view": "View members",
  "members.edit": "Edit members",
  "members.delete": "Delete members",
  "plans.view": "View plans",
  "plans.manage": "Manage plans",
  "billing.view": "View billing",
  "billing.collect": "Collect payments",
  "billing.void": "Void invoices",
  "checkins.create": "Record check-ins",
  "leads.view": "View leads",
  "leads.edit": "Manage leads",
  "messages.send": "Send messages",
  "dashboard.money": "View revenue",
  "finance.view": "View finance",
  "finance.edit": "Edit expenses",
  "automations.view": "View automations",
  "automations.manage": "Manage automations",
  "website.manage": "Manage website",
  "audit.view": "View audit log",
  "settings.manage": "Manage settings",
  "staff.manage": "Manage staff",
};

export function StaffView({
  staff,
  permissions,
  gymId,
  gymName,
  currentUserId,
}: {
  staff: Member[];
  permissions: { cap: string; roles: StaffRole[] }[];
  gymId: string;
  gymName: string;
  currentUserId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", role: "frontdesk" as StaffRole });
  const [reveal, setReveal] = React.useState<RevealData | null>(null);
  const [pending, start] = React.useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  function revealCredentials(email: string, password: string | null, existing = false) {
    setReveal({
      gymId,
      gymName,
      email,
      password,
      loginUrl: `${location.origin}/login`,
      audience: "team member",
      note: existing
        ? "This person already has an account. Their password has not changed; share the sign-in link with them."
        : "Copy these details now and share them securely with the team member. The password is shown only once.",
    });
  }
  function changeRole(m: Member, role: StaffRole) {
    if (role === m.role || role === "owner") return;
    start(async () => {
      const r = await updateStaffRoleAction(m.id, role);
      if (r.ok) {
        notify.success(r.message ?? "Role updated");
        router.refresh();
      } else notify.error(r.error);
    });
  }
  function remove(m: Member) {
    void (async () => {
      if (
        !(await confirm({
          title: `Remove ${m.name}?`,
          description: "They will lose access to this gym and be signed out immediately.",
          confirmLabel: "Remove member",
          destructive: true,
        }))
      )
        return;
      start(async () => {
        const r = await removeStaffAction(m.id);
        if (r.ok) {
          notify.success(r.message ?? "Removed from team");
          router.refresh();
        } else notify.error(r.error);
      });
    })();
  }
  function reset(m: Member) {
    void (async () => {
      if (
        !(await confirm({
          title: `Reset ${m.name}'s password?`,
          description: "Their current sessions will end. Copy the new one-time password before closing the dialog.",
          confirmLabel: "Reset password",
        }))
      )
        return;
      start(async () => {
        const r = await resetStaffPasswordAction(m.id);
        if (r.ok && r.data) {
          notify.success("Password reset");
          revealCredentials(r.data.email, r.data.password);
        } else notify.error(r.ok ? "Password was reset, but the new password could not be shown." : r.error);
      });
    })();
  }
  const columns: Column<Member>[] = [
    {
      id: "name",
      header: "Team member",
      sort: (m) => m.name.toLowerCase(),
      cell: (m) => (
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={m.name} size={34} />
          <div className="min-w-0">
            <p className="truncate font-medium">{m.name}</p>
            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      sort: (m) => m.role,
      cell: (m) =>
        m.role === "owner" ? (
          <Tag tone="lime">Owner</Tag>
        ) : (
          <Select value={m.role} disabled={pending} onValueChange={(v) => changeRole(m, v as StaffRole)}>
            <SelectTrigger size="sm" aria-label={`Role for ${m.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {editableRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
    },
    { id: "status", header: "Status", hideBelow: "md", cell: (m) => <Tag tone={m.confirmed ? "green" : "amber"}>{m.confirmed ? "Active" : "Invited"}</Tag> },
    { id: "joined", header: "Joined", hideBelow: "lg", sort: (m) => m.joined, cell: (m) => <span className="text-muted-foreground">{fmtDate(m.joined)}</span> },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (m) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Reset password for ${m.name}`}
            title="Reset password"
            disabled={pending || (m.role === "owner" && m.userId !== currentUserId)}
            onClick={() => reset(m)}
          >
            <AnimatedIcon icon={KeyRound} />
          </Button>
          {m.role !== "owner" && m.userId !== currentUserId && (
            <Button
              variant="destructive-soft"
              size="icon-sm"
              aria-label={`Remove ${m.name}`}
              title="Remove member"
              disabled={pending}
              onClick={() => remove(m)}
            >
              <AnimatedIcon icon={Trash2} />
            </Button>
          )}
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Staff" }]}
        title="Team & access"
        description="Invite staff and control what each role can do."
        actions={
          <Button onClick={() => setOpen(true)}>
            <AnimatedIcon icon={Plus} /> Add team member
          </Button>
        }
      />
      <DataTable
        rows={staff}
        columns={columns}
        getId={(m) => m.id}
        noun={["team member", "team members"]}
        search={(m) => `${m.name} ${m.email} ${m.role}`}
        searchPlaceholder="Search team"
        empty={{ icon: UsersRound, title: "No team members", description: "Invite your first team member to help run the gym." }}
      />
      <div className="surface mt-5 overflow-hidden">
        <div className="p-5">
          <SectionTitle>
            <span className="anim-host inline-flex items-center gap-2">
              <AnimatedIcon icon={ShieldCheck} className="size-4" /> Role permissions
            </span>
          </SectionTitle>
          <p className="text-sm text-muted-foreground">
            Permissions are assigned by role. The owner can manage settings and staff; managers handle operations and finance.
          </p>
        </div>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="bg-muted/55 text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Capability</th>
                {roles.map((r) => (
                  <th key={r} className="px-3 py-3 text-center font-medium">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.label}>
                  <tr className="border-t bg-muted/25">
                    <th colSpan={5} className="px-5 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {g.label}
                    </th>
                  </tr>
                  {g.caps.map((cap) => (
                    <tr key={cap} className="border-t">
                      <th className="px-5 py-2.5 text-left font-normal">{capLabel[cap]}</th>
                      {roles.map((r) => (
                        <td key={r} className="px-3 py-2.5 text-center">
                          {permissions.find((p) => p.cap === cap)?.roles.includes(r) ? (
                            <Check aria-label="Allowed" className="mx-auto size-4 text-success-ink" />
                          ) : (
                            <span aria-label="Not allowed" className="text-subtle">
                              —
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <div>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription className="mt-1">Invite someone to help manage this gym.</DialogDescription>
          </div>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await addStaffAction(form);
                if (r.ok && r.data) {
                  notify.success(r.message ?? "Team member added");
                  setOpen(false);
                  setForm({ name: "", email: "", role: "frontdesk" });
                  revealCredentials(r.data.email, r.data.password, r.data.existing);
                  router.refresh();
                } else notify.error(r.ok ? "Team member added, but credentials could not be shown." : r.error);
              });
            }}
          >
            <Field label="Full name" required>
              <Input required minLength={2} maxLength={128} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email" required>
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Role">
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Add member
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <CredentialsReveal data={reveal} open={!!reveal} onOpenChange={(v) => !v && setReveal(null)} />
    </>
  );
}
