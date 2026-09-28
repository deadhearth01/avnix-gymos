/**
 * Stock photography bundled with GymOS (generated for us, no licence strings attached).
 * A site image slot holds either an Appwrite file id or `preset:<name>`.
 */
export const PHOTO_PRESETS = {
  "hero-deadlift": "Deadlift by the windows",
  "hero-ropes": "Battle ropes",
  "weights-rack": "Dumbbell rack",
  "cardio-deck": "Cardio deck at sunrise",
  kettlebell: "Kettlebell swing",
  spotting: "Spotting on the bench",
  "stretch-zone": "Stretch zone",
  lockers: "Locker room",
  "pt-session": "Personal training",
  community: "Group class",
} as const;

export const TRAINER_PRESETS = { kiran: "Kiran", sravani: "Sravani", arjun: "Arjun" } as const;

export type PhotoPreset = keyof typeof PHOTO_PRESETS;
const PREFIX = "preset:";

export function isPreset(id: string | null | undefined): id is `preset:${string}` {
  if (!id?.startsWith(PREFIX)) return false;
  const name = id.slice(PREFIX.length);
  return name in PHOTO_PRESETS || (name.startsWith("trainer-") && name.slice(8) in TRAINER_PRESETS);
}

/** Path of a bundled preset, or null when `id` is not a known preset. */
export function presetUrl(id: string | null | undefined, size: "sm" | "lg" = "lg"): string | null {
  if (!isPreset(id)) return null;
  const name = id.slice(PREFIX.length);
  if (name.startsWith("trainer-")) return `/site-defaults/trainers/${name.slice(8)}.webp`;
  return `/site-defaults/${name}${size === "sm" ? "-sm" : ""}.webp`;
}

export const preset = (name: PhotoPreset) => `${PREFIX}${name}`;
export const trainerPreset = (name: keyof typeof TRAINER_PRESETS) => `${PREFIX}trainer-${name}`;
