"use client";

import * as React from "react";
import { applyFmt, type FmtKey } from "@/lib/fmt-keys";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { label: string; value: number; compare?: number };

export function AreaTrend({
  data,
  fmt = "number",
  height = 220,
  color = "var(--primary)",
  compareLabel,
}: {
  data: Datum[];
  fmt?: FmtKey;
  height?: number;
  color?: string;
  compareLabel?: string;
}) {
  const id = React.useId().replace(/:/g, "");
  const format = (n: number) => applyFmt(fmt, n);
  return (
    <div style={{ height }} className="w-full [&_.recharts-cartesian-axis-tick_text]:fill-[var(--subtle)] [&_.recharts-surface]:overflow-visible">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tickMargin={8} minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} tickFormatter={(v: number) => format(v)} />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-float)]">
                  <p className="mb-1 text-muted-foreground">{label}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="tabular flex items-center gap-2 font-medium">
                      <span className="size-2 rounded-full" style={{ background: p.dataKey === "compare" ? "var(--subtle)" : color }} />
                      {p.dataKey === "compare" ? compareLabel : "Current"}: {format(Number(p.value))}
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          {data.some((d) => d.compare != null) && (
            <Area
              type="monotone"
              dataKey="compare"
              stroke="var(--subtle)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              fill="none"
              dot={false}
              isAnimationActive
              animationDuration={900}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.25}
            fill={`url(#g-${id})`}
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)", fill: color }}
            isAnimationActive
            animationDuration={1100}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
