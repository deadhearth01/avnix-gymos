"use client";

import * as React from "react";
import { motion } from "motion/react";
import { TriangleAlert, CircleHelp } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { emitFeedback } from "@/components/feedback/feedback-provider";

type Opts = { title: string; description?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; typeToConfirm?: string };
type Ctx = (o: Opts) => Promise<boolean>;

const ConfirmContext = React.createContext<Ctx>(async () => false);
export const useConfirm = () => React.useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(Opts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = React.useState("");

  const confirm = React.useCallback<Ctx>((o) => {
    emitFeedback(o.destructive ? "warning" : "tap");
    setTyped("");
    return new Promise((resolve) => setState({ ...o, resolve }));
  }, []);

  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const blocked = !!state?.typeToConfirm && typed.trim() !== state.typeToConfirm;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onOpenChange={(v) => !v && close(false)}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          {state && (
            <div className="flex gap-4">
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className={`grid size-10 shrink-0 place-items-center rounded-full ${state.destructive ? "bg-danger-soft text-danger-ink" : "bg-info-soft text-info-ink"}`}
              >
                {state.destructive ? <TriangleAlert className="size-5" /> : <CircleHelp className="size-5" />}
              </motion.span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base">{state.title}</DialogTitle>
                {state.description && <DialogDescription className="mt-1.5">{state.description}</DialogDescription>}
                {state.typeToConfirm && (
                  <label className="mt-4 block text-sm">
                    Type <b className="font-mono">{state.typeToConfirm}</b> to confirm
                    <input
                      autoFocus
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-[10px] border bg-card px-3 font-mono text-sm outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                    />
                  </label>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => close(false)}>
                    {state.cancelLabel ?? "Cancel"}
                  </Button>
                  <Button
                    variant={state.destructive ? "destructive" : "default"}
                    disabled={blocked}
                    onClick={() => close(true)}
                    autoFocus={!state.typeToConfirm}
                  >
                    {state.confirmLabel ?? "Confirm"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
