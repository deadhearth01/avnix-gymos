"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/kit/page-header";
import { Field, FormSection, AffixInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { mediaUrl } from "@/lib/media";
import { inr } from "@/lib/format";
import { PHOTO_PRESETS, preset, type PhotoPreset } from "@/lib/site/presets";
import { notify } from "@/lib/notify";
import type { GymSite } from "@/lib/types";
import { setPlanPriceAction } from "../_actions/plans";
import { updateSiteAction, uploadSiteImageAction } from "../_actions/settings";

type Props = {
  initialSite: GymSite;
  initialEnabled: boolean;
  gymName: string;
  brandColor: string;
  subdomain: string;
  customDomain: string | null;
  customDomainStatus: string;
  customDomainEnabled: boolean;
  publicUrl: string;
  previewUrl: string;
  plans: SitePlan[];
  canEditPrices: boolean;
};
type SitePlan = { id: string; name: string; type: string; price: number; sessions: number; durationDays: number };
type Draft = { site: GymSite; siteEnabled: boolean };
type UploadTarget = { kind: "hero" | "gallery" | "trainer"; index?: number };
type PendingImage = { key: string; url: string; kind: UploadTarget["kind"]; index?: number };
/** The editor column is narrow next to the preview, so sections stack until very wide screens. */
const SECTION = "lg:grid-cols-1 lg:gap-5 2xl:grid-cols-[220px_minmax(0,1fr)] 2xl:gap-10";
const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";
const ALLOWED = new Set(ACCEPT.split(","));

function ImageDrop({
  label,
  multiple,
  disabled,
  onFiles,
  children,
}: {
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children?: React.ReactNode;
}) {
  const [dragging, setDragging] = React.useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-3 text-center transition-colors ${dragging ? "border-primary bg-success-soft/40" : "border-border hover:bg-muted/40"} ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      {children ?? <Upload className="size-5 text-muted-foreground" />}
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">Drop or browse · PNG, JPG, WebP, AVIF · max 8 MB</span>
      <input
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}

function ImageTile({ url, label, onRemove, busy }: { url: string | null; label: string; onRemove?: () => void; busy?: boolean }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted/50">
      {url ? (
        <div role="img" aria-label={label} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />
      ) : (
        <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>
      )}
      {busy && <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-medium text-white">Uploading…</div>}
      {onRemove && !busy && (
        <Button type="button" size="icon-xs" variant="destructive" aria-label={`Remove ${label}`} className="absolute top-2 right-2" onClick={onRemove}>
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

export function WebsiteEditor({
  initialSite,
  initialEnabled,
  gymName,
  brandColor,
  subdomain,
  customDomain,
  customDomainStatus,
  customDomainEnabled,
  publicUrl,
  previewUrl,
  plans,
  canEditPrices,
}: Props) {
  const router = useRouter();
  const [saved, setSaved] = React.useState<Draft>({ site: initialSite, siteEnabled: initialEnabled });
  const [draft, setDraft] = React.useState<Draft>({ site: initialSite, siteEnabled: initialEnabled });
  const [saving, setSaving] = React.useState(false);
  const [pendingImages, setPendingImages] = React.useState<PendingImage[]>([]);
  const uploadCount = pendingImages.length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const site = draft.site;
  const amenities = site.amenities ?? [];
  const hours = site.hours ?? [];
  const trainers = site.trainers ?? [];
  const gallery = site.gallery ?? [];
  const faqs = site.faqs ?? [];
  const socials = site.socials ?? {};
  const heroPending = pendingImages.find((p) => p.kind === "hero");
  const heroUrl = heroPending?.url ?? mediaUrl(site.heroFileId, { width: 900, height: 520 });

  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function patch(sitePatch: Partial<GymSite>) {
    setDraft((d) => ({ ...d, site: { ...d.site, ...sitePatch } }));
  }
  function validateFile(file: File) {
    if (!ALLOWED.has(file.type)) {
      notify.error("Use a PNG, JPG, WebP or AVIF image.");
      return false;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify.error("Images must be 8 MB or smaller.");
      return false;
    }
    return true;
  }
  async function upload(files: File[], target: UploadTarget) {
    const valid = files.filter(validateFile);
    if (target.kind !== "gallery" && valid.length > 1) valid.splice(1);
    if (target.kind === "gallery" && gallery.length + uploadCount + valid.length > 24) {
      notify.error("The gallery can hold up to 24 images.");
      return;
    }
    for (const file of valid) {
      const key = crypto.randomUUID();
      const url = URL.createObjectURL(file);
      setPendingImages((p) => [...p, { key, url, kind: target.kind, index: target.index }]);
      const data = new FormData();
      data.set("file", file);
      try {
        const result = await uploadSiteImageAction(data);
        if (!result.ok) {
          notify.error(result.error);
          continue;
        }
        const fileId = result.data?.fileId;
        if (!fileId) {
          notify.error("Upload did not return an image. Please try again.");
          continue;
        }
        setDraft((d) => {
          const s = d.site;
          if (target.kind === "hero") return { ...d, site: { ...s, heroFileId: fileId } };
          if (target.kind === "gallery") return { ...d, site: { ...s, gallery: [...(s.gallery ?? []), fileId] } };
          return { ...d, site: { ...s, trainers: (s.trainers ?? []).map((t, i) => (i === target.index ? { ...t, photoFileId: fileId } : t)) } };
        });
      } catch {
        notify.error("Upload failed. Please try again.");
      } finally {
        setPendingImages((p) => p.filter((item) => item.key !== key));
        URL.revokeObjectURL(url);
      }
    }
  }
  function moveTrainer(index: number, direction: number) {
    const next = [...trainers];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    patch({ trainers: next });
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      notify.success("Website link copied");
    } catch {
      notify.error("Could not copy the link.");
    }
  }
  async function publish() {
    if (saving || uploadCount || !dirty) return;
    const snapshot = draft;
    setSaving(true);
    try {
      const result = await updateSiteAction(snapshot);
      if (result.ok) {
        setSaved(snapshot);
        notify.success(result.message ?? "Website published");
        router.refresh();
      } else notify.error(result.error);
    } catch {
      notify.error("Could not publish the website.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Website editor"
        description="Make a great first impression for future members."
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Website" }]}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="surface min-w-0 px-5 pt-7 sm:px-7">
          <FormSection className={SECTION} title="Hero" description="The first thing visitors see. Keep the headline short and punchy.">
            <Field label="Headline" className="sm:col-span-2" hint={`${(site.tagline ?? "").length}/60 · shown in large capitals`}>
              <Input maxLength={60} value={site.tagline ?? ""} placeholder="Lift heavy. Leave lighter." onChange={(e) => patch({ tagline: e.target.value })} />
            </Field>
            <Field label="Supporting line" className="sm:col-span-2" hint={`${(site.heroText ?? "").length}/220 · one or two sentences under the headline`}>
              <Textarea
                rows={2}
                maxLength={220}
                value={site.heroText ?? ""}
                placeholder="Coaching, serious equipment and people who notice when you don’t show up."
                onChange={(e) => patch({ heroText: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_1.4fr]">
              <ImageTile
                url={heroUrl}
                label="Hero image"
                busy={!!heroPending}
                onRemove={site.heroFileId ? () => patch({ heroFileId: undefined }) : undefined}
              />
              <ImageDrop
                label={uploadCount ? "Uploading image…" : "Upload your own photo"}
                disabled={uploadCount > 0}
                onFiles={(files) => void upload(files, { kind: "hero" })}
              />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">Or pick a stock photo</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(Object.keys(PHOTO_PRESETS) as PhotoPreset[]).map((name) => {
                  const id = preset(name);
                  const active = site.heroFileId === id;
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={active}
                      aria-label={`Use stock photo: ${PHOTO_PRESETS[name]}`}
                      title={PHOTO_PRESETS[name]}
                      onClick={() => patch({ heroFileId: id })}
                      className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted bg-cover bg-center outline-offset-2 transition-shadow ${active ? "outline-2 outline-primary" : "hover:opacity-90"}`}
                      style={{ backgroundImage: `url(/site-defaults/${name}-sm.webp)` }}
                    >
                      {active && (
                        <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">No photo selected? Your site uses a strength-floor photo by default.</p>
            </div>
          </FormSection>

          <FormSection className={SECTION} title="About your gym" description="A short paragraph for the “The gym” section.">
            <Field label="About" className="sm:col-span-2" hint={`${(site.about ?? "").length}/600`}>
              <Textarea rows={4} maxLength={600} value={site.about ?? ""} onChange={(e) => patch({ about: e.target.value })} />
            </Field>
          </FormSection>

          <FormSection className={SECTION} title="Amenities" description="Add up to 24 short highlights.">
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {amenities.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-sm">
                  {item}
                  <button type="button" aria-label={`Remove ${item}`} onClick={() => patch({ amenities: amenities.filter((_, n) => n !== i) })}>
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="flex gap-2 sm:col-span-2"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("amenity") as HTMLInputElement;
                const value = input.value.trim();
                if (value && amenities.length < 24) {
                  patch({ amenities: [...amenities, value] });
                  input.value = "";
                }
              }}
            >
              <Input name="amenity" aria-label="New amenity" maxLength={48} placeholder="e.g. Personal training" disabled={amenities.length >= 24} />
              <Button type="submit" variant="outline" disabled={amenities.length >= 24}>
                <Plus /> Add
              </Button>
            </form>
          </FormSection>

          <FormSection className={SECTION} title="Opening hours" description="Use one row for each day or group of days.">
            <div className="grid gap-3 sm:col-span-2">
              {hours.map((row, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_100px_100px_32px] items-center gap-2 max-sm:grid-cols-[minmax(0,1fr)_90px_90px_32px]">
                  <Input
                    aria-label={`Days for row ${i + 1}`}
                    maxLength={32}
                    placeholder="Mon–Fri"
                    value={row.days}
                    onChange={(e) => patch({ hours: hours.map((r, n) => (n === i ? { ...r, days: e.target.value } : r)) })}
                  />
                  <Input
                    aria-label={`Opening time for row ${i + 1}`}
                    type="time"
                    value={row.open}
                    onChange={(e) => patch({ hours: hours.map((r, n) => (n === i ? { ...r, open: e.target.value } : r)) })}
                  />
                  <Input
                    aria-label={`Closing time for row ${i + 1}`}
                    type="time"
                    value={row.close}
                    onChange={(e) => patch({ hours: hours.map((r, n) => (n === i ? { ...r, close: e.target.value } : r)) })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove hours row"
                    onClick={() => patch({ hours: hours.filter((_, n) => n !== i) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={hours.length >= 7}
              onClick={() => patch({ hours: [...hours, { days: "", open: "06:00", close: "22:00" }] })}
            >
              <Plus /> Add hours
            </Button>
          </FormSection>

          <FormSection className={SECTION} title="Coaches" description="Shown as tilt cards. Portraits with a plain or transparent background look best.">
            <div className="grid gap-3 sm:col-span-2">
              {trainers.map((trainer, i) => {
                const pending = pendingImages.find((p) => p.kind === "trainer" && p.index === i);
                const photo = pending?.url ?? mediaUrl(trainer.photoFileId, { width: 240, height: 300 });
                const set = (patchT: Partial<typeof trainer>) => patch({ trainers: trainers.map((t, n) => (n === i ? { ...t, ...patchT } : t)) });
                return (
                  <div key={i} className="grid min-w-0 gap-4 rounded-xl border p-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                    <div className="flex gap-3 sm:flex-col">
                      <label
                        className={`relative block aspect-[4/5] w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-muted/60 bg-cover bg-center ${uploadCount > 0 ? "pointer-events-none opacity-60" : "hover:border-primary"}`}
                        style={photo ? { backgroundImage: `url(${photo})` } : undefined}
                        aria-label={`Upload portrait for ${trainer.name || "coach"}`}
                      >
                        {!photo && (
                          <span className="grid h-full place-items-center text-muted-foreground">
                            <ImagePlus className="size-5" />
                          </span>
                        )}
                        {pending && <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs font-medium text-white">Uploading…</span>}
                        <input
                          type="file"
                          accept={ACCEPT}
                          className="sr-only"
                          onChange={(e) => {
                            void upload(Array.from(e.target.files ?? []), { kind: "trainer", index: i });
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {trainer.photoFileId && !pending && (
                        <Button type="button" variant="ghost" size="xs" className="w-fit" onClick={() => set({ photoFileId: undefined })}>
                          Remove photo
                        </Button>
                      )}
                    </div>
                    <div className="grid min-w-0 content-start gap-3 sm:grid-cols-2">
                      <Field label="Name">
                        <Input required maxLength={64} value={trainer.name} onChange={(e) => set({ name: e.target.value })} />
                      </Field>
                      <Field label="Role">
                        <Input maxLength={64} placeholder="Head coach, strength" value={trainer.role} onChange={(e) => set({ role: e.target.value })} />
                      </Field>
                      <Field label="Experience" optional>
                        <Input
                          maxLength={40}
                          placeholder="8 years coaching"
                          value={trainer.experience ?? ""}
                          onChange={(e) => set({ experience: e.target.value })}
                        />
                      </Field>
                      <Field label="Instagram handle" optional>
                        <AffixInput
                          leading="@"
                          maxLength={40}
                          placeholder="coach.name"
                          value={(trainer.instagram ?? "").replace(/^@/, "")}
                          onChange={(e) => set({ instagram: e.target.value.replace(/^@/, "") })}
                        />
                      </Field>
                      <div className="flex flex-wrap gap-1 sm:col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${trainer.name || "coach"} up`}
                          disabled={i === 0 || uploadCount > 0}
                          onClick={() => moveTrainer(i, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${trainer.name || "coach"} down`}
                          disabled={i === trainers.length - 1 || uploadCount > 0}
                          onClick={() => moveTrainer(i, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive-soft"
                          size="sm"
                          className="ml-auto"
                          disabled={uploadCount > 0}
                          onClick={() => patch({ trainers: trainers.filter((_, n) => n !== i) })}
                        >
                          <Trash2 /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={trainers.length >= 6 || uploadCount > 0}
              onClick={() => patch({ trainers: [...trainers, { name: "", role: "" }] })}
            >
              <Plus /> Add coach
            </Button>
          </FormSection>

          <FormSection className={SECTION} title="Gallery" description="Add up to 24 photos of your space and community.">
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-3">
              {gallery.map((id, i) => (
                <ImageTile
                  key={`${id}-${i}`}
                  url={mediaUrl(id, { width: 360, height: 270 })}
                  label={`Gallery image ${i + 1}`}
                  onRemove={() => patch({ gallery: gallery.filter((_, n) => n !== i) })}
                />
              ))}
              {pendingImages
                .filter((p) => p.kind === "gallery")
                .map((p) => (
                  <ImageTile key={p.key} url={p.url} label="Uploading gallery image" busy />
                ))}
            </div>
            <div className="sm:col-span-2">
              <ImageDrop
                label={uploadCount ? `Uploading ${uploadCount} image${uploadCount === 1 ? "" : "s"}…` : "Add gallery images"}
                multiple
                disabled={gallery.length + uploadCount >= 24}
                onFiles={(files) => void upload(files, { kind: "gallery" })}
              />
            </div>
          </FormSection>

          <FormSection className={SECTION} title="FAQs" description="Answer common questions before visitors call.">
            <div className="grid gap-4 sm:col-span-2">
              {faqs.map((faq, i) => (
                <div key={i} className="grid gap-3 rounded-xl border p-3">
                  <Field label={`Question ${i + 1}`}>
                    <Input maxLength={200} value={faq.q} onChange={(e) => patch({ faqs: faqs.map((f, n) => (n === i ? { ...f, q: e.target.value } : f)) })} />
                  </Field>
                  <Field label="Answer">
                    <Textarea
                      rows={3}
                      maxLength={1000}
                      value={faq.a}
                      onChange={(e) => patch({ faqs: faqs.map((f, n) => (n === i ? { ...f, a: e.target.value } : f)) })}
                    />
                  </Field>
                  <Button type="button" variant="destructive-soft" size="sm" className="w-fit" onClick={() => patch({ faqs: faqs.filter((_, n) => n !== i) })}>
                    <Trash2 /> Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" className="w-fit" disabled={faqs.length >= 12} onClick={() => patch({ faqs: [...faqs, { q: "", a: "" }] })}>
              <Plus /> Add FAQ
            </Button>
          </FormSection>

          <FormSection className={SECTION} title="Social links & map" description="Help visitors find and follow you.">
            {(["instagram", "facebook", "youtube", "google"] as const).map((key) => (
              <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
                <AffixInput
                  type="url"
                  trailing="↗"
                  maxLength={key === "google" ? 300 : 200}
                  value={socials[key] ?? ""}
                  placeholder="https://…"
                  onChange={(e) => patch({ socials: { ...socials, [key]: e.target.value } })}
                />
              </Field>
            ))}
            <Field label="Google Maps URL" className="sm:col-span-2">
              <Input
                type="url"
                maxLength={500}
                value={site.mapUrl ?? ""}
                placeholder="https://maps.google.com/…"
                onChange={(e) => patch({ mapUrl: e.target.value })}
              />
            </Field>
          </FormSection>

          <FormSection className={SECTION} title="Prices & trial" description="Choose what visitors can see and do.">
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium">Show prices</span>
                <span className="text-xs text-muted-foreground">Off: plans are listed without prices and visitors are asked to enquire.</span>
              </span>
              <Switch checked={site.showPrices !== false} onCheckedChange={(checked) => patch({ showPrices: checked })} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium">Free trial booking</span>
                <span className="text-xs text-muted-foreground">Off: trial buttons and the form are replaced with WhatsApp and call buttons.</span>
              </span>
              <Switch checked={site.showTrial !== false} onCheckedChange={(checked) => patch({ showTrial: checked })} />
            </label>
            <PlanPrices plans={plans} canEdit={canEditPrices} />
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium">Website live</span>
                <span className="text-xs text-muted-foreground">Turn off to show a “back soon” page instead.</span>
              </span>
              <Switch checked={draft.siteEnabled} onCheckedChange={(checked) => setDraft((d) => ({ ...d, siteEnabled: checked }))} />
            </label>
          </FormSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="surface overflow-hidden">
            <div className="px-4 py-3 text-xs font-medium text-muted-foreground">Preview</div>
            <div
              className="min-h-52 bg-cover bg-center"
              style={{
                backgroundColor: brandColor,
                backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.72), rgba(0,0,0,.1)), url(${heroUrl ?? "/site-defaults/hero-deadlift-sm.webp"})`,
              }}
            >
              <div className="flex min-h-52 flex-col justify-end p-5 text-white">
                <p className="text-xs font-semibold opacity-80">{gymName}</p>
                <h2 className="mt-2 font-display text-[28px] leading-[0.95] font-extrabold uppercase [font-stretch:75%]">
                  {site.tagline || "Train hard. Train right."}
                </h2>
                {site.heroText && <p className="mt-2 line-clamp-2 text-xs text-white/80">{site.heroText}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              <Button size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open website
                </a>
              </Button>
              <Button size="sm" variant="outline" onClick={() => void copyLink()}>
                <Copy /> Copy link
              </Button>
            </div>
          </div>
          <div className="surface space-y-4 p-5">
            <h2 className="text-sm font-semibold">Domains</h2>
            <div>
              <p className="text-xs text-muted-foreground">Built-in subdomain · Always connected</p>
              <p className="text-sm font-medium break-all">{subdomain}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Custom domain · {customDomainEnabled ? customDomainStatus : "Not connected"}</p>
              <p className="text-sm font-medium break-all">{customDomain || "No custom domain"}</p>
            </div>
            <p className="text-xs text-muted-foreground">Custom domains are connected by AvniX — contact support.</p>
            <a className="text-xs font-medium text-primary underline-offset-2 hover:underline" href={previewUrl} target="_blank" rel="noreferrer">
              Open preview
            </a>
          </div>
        </aside>
      </div>
      <div
        aria-hidden={!dirty}
        className={`fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,.09)] backdrop-blur transition-all duration-300 ${dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"}`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="grid size-7 place-items-center rounded-full bg-warning-soft text-warning-ink">
              <Check className="size-4" />
            </span>
            <span>Unsaved changes{uploadCount ? ` · ${uploadCount} uploading` : ""}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving || uploadCount > 0} onClick={() => setDraft(saved)}>
              Discard
            </Button>
            <Button type="button" loading={saving} disabled={uploadCount > 0} onClick={() => void publish()}>
              Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function planLength(plan: SitePlan) {
  if (plan.type !== "duration") return `${plan.sessions} sessions`;
  const months = Math.round(plan.durationDays / 30);
  return months > 0 && Math.abs(plan.durationDays - months * 30) <= 5 ? `${months} mo` : `${plan.durationDays} days`;
}

/** Membership and PT prices, editable in place (saved immediately, independent of Publish). */
function PlanPrices({ plans, canEdit }: { plans: SitePlan[]; canEdit: boolean }) {
  const [prices, setPrices] = React.useState<Record<string, number>>(() => Object.fromEntries(plans.map((p) => [p.id, p.price])));
  const [savingId, setSavingId] = React.useState<string | null>(null);
  async function save(plan: SitePlan) {
    const value = prices[plan.id];
    if (value === plan.price || !Number.isFinite(value) || value < 0) return;
    setSavingId(plan.id);
    try {
      const result = await setPlanPriceAction(plan.id, value);
      if (result.ok) notify.success(`${plan.name}: ${inr(value)}`);
      else {
        notify.error(result.error);
        setPrices((p) => ({ ...p, [plan.id]: plan.price }));
      }
    } finally {
      setSavingId(null);
    }
  }
  const groups = [
    { label: "Memberships", rows: plans.filter((p) => p.type === "duration") },
    { label: "Personal training", rows: plans.filter((p) => p.type !== "duration") },
  ].filter((g) => g.rows.length);
  return (
    <div className="rounded-xl border sm:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <span className="text-sm font-medium">Membership & PT rates</span>
        <a href="/plans" className="text-xs font-medium text-primary hover:underline">
          Manage plans
        </a>
      </div>
      {groups.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground">No active plans yet. Add plans to show pricing on your site.</p>}
      {groups.map((group) => (
        <div key={group.label} className="px-4 py-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
          <ul className="divide-y">
            {group.rows.map((plan) => (
              <li key={plan.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{plan.name}</span>
                  {!plan.name.includes(String(plan.sessions || "~")) && <span className="text-xs text-muted-foreground">{planLength(plan)}</span>}
                </span>
                {canEdit ? (
                  <AffixInput
                    leading="₹"
                    inputMode="numeric"
                    aria-label={`Price for ${plan.name}`}
                    className="w-32 tabular-nums"
                    disabled={savingId === plan.id}
                    value={String(prices[plan.id] ?? "")}
                    onChange={(e) => setPrices((p) => ({ ...p, [plan.id]: Number(e.target.value.replace(/[^\d]/g, "")) }))}
                    onBlur={() => void save(plan)}
                    onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                  />
                ) : (
                  <span className="text-sm font-medium tabular-nums">{inr(plan.price)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
