import { FadeIn } from "@/components/kit/motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return <FadeIn y={6}>{children}</FadeIn>;
}
