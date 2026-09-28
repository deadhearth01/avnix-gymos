import { requireCap } from "@/lib/auth/session";
import { brandThemeCss } from "@/lib/brand-theme";
import { identifyFaceAction } from "@/app/(gym)/_actions/devices";
import { KioskView } from "./kiosk-view";

export const metadata = { title: "Face ID kiosk" };

export default async function KioskPage() {
  const ctx = await requireCap("checkins.create");
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(ctx.gym.brandColor) }} />
      <KioskView gymName={ctx.gym.name} identify={identifyFaceAction} />
    </>
  );
}
