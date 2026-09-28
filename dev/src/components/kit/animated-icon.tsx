import * as React from "react";
import type { IconComponent, IconProps } from "@/components/icons";
import { cn } from "@/lib/utils";

export type IconAnimation =
  "bounce" | "wiggle" | "spin" | "ring" | "lift" | "pulse" | "nudge" | "tilt" | "float" | "swing" | "rise" | "shake" | "beat" | "flip" | "none";

/** Sensible default motion per icon, keyed by icon display name. */
const BY_NAME: Record<string, IconAnimation> = {
  House: "bounce",
  Home: "bounce",
  LayoutDashboard: "tilt",
  Users: "bounce",
  UsersRound: "bounce",
  UserRound: "bounce",
  UserPlus: "pulse",
  UserCheck: "pulse",
  Bell: "ring",
  BellRing: "ring",
  Settings: "spin",
  Settings2: "spin",
  Cog: "spin",
  Search: "tilt",
  Plus: "spin",
  X: "spin",
  Check: "pulse",
  CheckCheck: "pulse",
  ChevronRight: "nudge",
  ArrowRight: "nudge",
  ArrowUpRight: "lift",
  ExternalLink: "lift",
  Dumbbell: "float",
  Zap: "shake",
  Sparkles: "pulse",
  Wand2: "wiggle",
  WandSparkles: "wiggle",
  CalendarDays: "flip",
  Calendar: "flip",
  CalendarClock: "flip",
  Clock: "spin",
  Timer: "wiggle",
  Receipt: "rise",
  ReceiptText: "rise",
  Wallet: "wiggle",
  CreditCard: "flip",
  IndianRupee: "bounce",
  Banknote: "wiggle",
  Landmark: "bounce",
  PiggyBank: "wiggle",
  ChartColumn: "rise",
  ChartLine: "rise",
  ChartPie: "spin",
  TrendingUp: "rise",
  TrendingDown: "rise",
  Activity: "beat",
  HeartPulse: "beat",
  Heart: "beat",
  MessageCircle: "wiggle",
  WhatsApp: "wiggle",
  MessageSquare: "wiggle",
  MessagesSquare: "wiggle",
  Send: "nudge",
  SendHorizontal: "nudge",
  Mail: "wiggle",
  Phone: "ring",
  PhoneCall: "ring",
  LogOut: "nudge",
  LogIn: "nudge",
  Moon: "swing",
  Sun: "spin",
  Globe: "spin",
  Link: "tilt",
  Copy: "pulse",
  Trash2: "shake",
  Pencil: "wiggle",
  PenLine: "wiggle",
  Filter: "swing",
  SlidersHorizontal: "shake",
  Download: "bounce",
  Upload: "rise",
  RefreshCw: "spin",
  RotateCw: "spin",
  Shield: "pulse",
  ShieldCheck: "pulse",
  Lock: "shake",
  KeyRound: "wiggle",
  Snowflake: "spin",
  Play: "pulse",
  Pause: "pulse",
  Power: "pulse",
  Building2: "rise",
  Store: "bounce",
  ScanLine: "pulse",
  QrCode: "pulse",
  Fingerprint: "pulse",
  LifeBuoy: "spin",
  Headset: "wiggle",
  HelpCircle: "wiggle",
  CircleHelp: "wiggle",
  Megaphone: "wiggle",
  Target: "pulse",
  Flame: "wiggle",
  Trophy: "bounce",
  Star: "spin",
  Gift: "wiggle",
  Cake: "bounce",
  Printer: "rise",
  FileText: "rise",
  Eye: "pulse",
  EyeOff: "pulse",
  MoreHorizontal: "pulse",
  Ellipsis: "pulse",
  PanelLeft: "nudge",
  PanelLeftClose: "nudge",
  Menu: "shake",
  Command: "spin",
  Workflow: "shake",
  Bot: "wiggle",
  Layers: "rise",
  Image: "tilt",
  Palette: "wiggle",
};

type Props = Omit<IconProps, "ref"> & {
  icon: IconComponent;
  animation?: IconAnimation;
  /** animate when the icon itself is hovered (no host needed) */
  self?: boolean;
  wrapperClassName?: string;
};

export function AnimatedIcon({ icon: Icon, animation, self, wrapperClassName, className, ...props }: Props) {
  const name = (Icon as { displayName?: string }).displayName ?? "";
  const anim = animation ?? BY_NAME[name] ?? "lift";
  return (
    <span aria-hidden className={cn("ai", anim !== "none" && `ai-${anim}`, self && "ai-self", wrapperClassName)}>
      <Icon className={cn("size-[1.1em]", className)} {...props} />
    </span>
  );
}
