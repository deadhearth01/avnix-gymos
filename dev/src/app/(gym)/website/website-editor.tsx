"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, Plus, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/kit/page-header";
import { Field, FormSection, AffixInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { mediaUrl } from "@/lib/media";
import { notify } from "@/lib/notify";
import type { GymSite } from "@/lib/types";
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
};
type Draft = { site: GymSite; siteEnabled: boolean };
type UploadTarget = { kind: "hero" | "gallery" | "trainer"; index?: number };
type PendingImage = { key: string; url: string; kind: UploadTarget["kind"]; index?: number };
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
        <div className="surface min-w-0 px-5 sm:px-7">
          <FormSection title="Hero" description="Introduce your gym in a few words.">
            <Field label="Tagline" className="sm:col-span-2" hint={`${(site.tagline ?? "").length}/140 characters`}>
              <Input maxLength={140} value={site.tagline ?? ""} placeholder="Stronger every day" onChange={(e) => patch({ tagline: e.target.value })} />
            </Field>
            <Field label="About" className="sm:col-span-2">
              <Textarea rows={5} maxLength={2000} value={site.about ?? ""} onChange={(e) => patch({ about: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_1.4fr]">
              <ImageTile
                url={heroUrl}
                label="Hero image"
                busy={!!heroPending}
                onRemove={site.heroFileId ? () => patch({ heroFileId: undefined }) : undefined}
              />
              <ImageDrop
                label={uploadCount ? "Uploading image…" : "Upload hero image"}
                disabled={uploadCount > 0}
                onFiles={(files) => void upload(files, { kind: "hero" })}
              />
            </div>
          </FormSection>

          <FormSection title="Amenities" description="Add up to 24 short highlights.">
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

          <FormSection title="Opening hours" description="Use one row for each day or group of days.">
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

          <FormSection title="Trainers" description="Show the people behind your gym. Drag in a portrait or browse.">
            <div className="grid gap-4 sm:col-span-2">
              {trainers.map((trainer, i) => {
                const pending = pendingImages.find((p) => p.kind === "trainer" && p.index === i);
                return (
                  <div key={i} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[110px_1fr]">
                    <div className="space-y-2">
                      <ImageTile
                        url={pending?.url ?? mediaUrl(trainer.photoFileId, { width: 240, height: 240 })}
                        label={`${trainer.name || "Trainer"} portrait`}
                        busy={!!pending}
                        onRemove={
                          trainer.photoFileId ? () => patch({ trainers: trainers.map((t, n) => (n === i ? { ...t, photoFileId: undefined } : t)) }) : undefined
                        }
                      />
                      <ImageDrop label="Photo" disabled={uploadCount > 0} onFiles={(files) => void upload(files, { kind: "trainer", index: i })} />
                    </div>
                    <div className="grid content-start gap-3">
                      <Field label="Name">
                        <Input
                          required
                          maxLength={64}
                          value={trainer.name}
                          onChange={(e) => patch({ trainers: trainers.map((t, n) => (n === i ? { ...t, name: e.target.value } : t)) })}
                        />
                      </Field>
                      <Field label="Role">
                        <Input
                          maxLength={64}
                          value={trainer.role}
                          onChange={(e) => patch({ trainers: trainers.map((t, n) => (n === i ? { ...t, role: e.target.value } : t)) })}
                        />
                      </Field>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${trainer.name || "trainer"} up`}
                          disabled={i === 0 || uploadCount > 0}
                          onClick={() => moveTrainer(i, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${trainer.name || "trainer"} down`}
                          disabled={i === trainers.length - 1 || uploadCount > 0}
                          onClick={() => moveTrainer(i, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive-soft"
                          size="sm"
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
              disabled={trainers.length >= 12 || uploadCount > 0}
              onClick={() => patch({ trainers: [...trainers, { name: "", role: "" }] })}
            >
              <Plus /> Add trainer
            </Button>
          </FormSection>

          <FormSection title="Gallery" description="Add up to 24 photos of your space and community.">
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

          <FormSection title="FAQs" description="Answer common questions before visitors call.">
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

          <FormSection title="Social links & map" description="Help visitors find and follow you.">
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

          <FormSection title="Visibility" description="Control what visitors can see.">
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium">Show prices</span>
                <span className="text-xs text-muted-foreground">Display plan prices on your public site.</span>
              </span>
              <Switch checked={!!site.showPrices} onCheckedChange={(checked) => patch({ showPrices: checked })} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium">Website live</span>
                <span className="text-xs text-muted-foreground">Publish the site for visitors when you save.</span>
              </span>
              <Switch checked={draft.siteEnabled} onCheckedChange={(checked) => setDraft((d) => ({ ...d, siteEnabled: checked }))} />
            </label>
          </FormSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="surface overflow-hidden">
            <div className="px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Live preview</div>
            <div
              className="min-h-52 bg-cover bg-center"
              style={{
                backgroundColor: brandColor,
                backgroundImage: heroUrl ? `linear-gradient(0deg, rgba(0,0,0,.68), rgba(0,0,0,.08)), url(${heroUrl})` : undefined,
              }}
            >
              <div className="flex min-h-52 flex-col justify-end p-5 text-white">
                <p className="text-xs font-semibold tracking-widest uppercase opacity-80">{gymName}</p>
                <h2 className="mt-2 text-2xl leading-tight font-semibold">{site.tagline || "Your gym, your story"}</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {amenities.slice(0, 3).map((a, i) => (
                    <span key={i} className="rounded-full bg-white/20 px-2 py-1 text-[11px] backdrop-blur">
                      {a}
                    </span>
                  ))}
                </div>
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
