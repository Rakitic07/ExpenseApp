"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";

type Point = { label: string; total: number; color?: string };

export default function Bars({
  data,
  color = "#b06bff",
}: {
  data: Point[];
  color?: string;
}) {
  const { format } = useCurrency();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.95} />
            <stop offset="100%" stopColor={color} stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => formatNumber(v as number)}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.06)" }}
          formatter={(value: number) => [format(value), "Total"]}
          contentStyle={{ color: "#fff" }}
          itemStyle={{ color: "#fff" }}
          labelStyle={{ color: "rgba(255,255,255,0.7)" }}
        />
        <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="url(#barFill)">
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? "url(#barFill)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
