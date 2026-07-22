"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { Slice } from "@/lib/analytics";
import { useCurrency } from "@/lib/currency";

export default function CategoryDonut({ data }: { data: Slice[] }) {
  const { format } = useCurrency();
  if (data.length === 0) {
    return <Empty />;
  }
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={62}
          outerRadius={100}
          paddingAngle={2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name) => [
            `${format(value)} (${((value / total) * 100).toFixed(1)}%)`,
            name,
          ]}
          contentStyle={{ color: "#fff" }}
          itemStyle={{ color: "#fff" }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-white/50">
      No data for this period yet.
    </div>
  );
}
