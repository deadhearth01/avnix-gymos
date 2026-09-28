"use client";

import * as React from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { applyFmt, type FmtKey } from "@/lib/fmt-keys";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Fade + rise entrance. Children with <FadeIn> inside <Stagger> cascade. */
export function FadeIn({ className, delay = 0, y = 10, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
      className={className}
      {...props}
    />
  );
}

const staggerParent = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } } };
const staggerChild = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE_OUT } },
};

export function Stagger({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className={className} {...props}>
      {children}
    </motion.div>
  );
}
export function StaggerItem({ className, ...props }: HTMLMotionProps<"div">) {
  return <motion.div variants={staggerChild} className={cn("h-full", className)} {...props} />;
}

/** Counts up to `value` when scrolled into view; re-animates on change. */
export function AnimatedNumber({ value, fmt = "number", className }: { value: number; fmt?: FmtKey; className?: string }) {
  const format = (n: number) => applyFmt(fmt, n);
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22, mass: 0.9 });
  const text = useTransform(spring, (v) => format(v));
  React.useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);
  return (
    <motion.span ref={ref} className={cn("tabular", className)}>
      {text}
    </motion.span>
  );
}

/** Subtle hover lift for cards. */
export function HoverLift({ className, ...props }: HTMLMotionProps<"div">) {
  return <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} className={cn("anim-host", className)} {...props} />;
}
