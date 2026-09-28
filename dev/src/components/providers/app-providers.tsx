"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";
import { ConfirmProvider } from "@/components/kit/confirm";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}>
        <FeedbackProvider>
          <TooltipProvider delayDuration={250} skipDelayDuration={120}>
            <ConfirmProvider>{children}</ConfirmProvider>
            <Toaster position="bottom-right" richColors={false} closeButton />
          </TooltipProvider>
        </FeedbackProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
