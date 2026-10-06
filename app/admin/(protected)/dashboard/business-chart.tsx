'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function BusinessChart({ data }: { data: Array<{ month: string; orderValue: number; costs: number }> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="business-chart business-chart-placeholder" aria-label="Graf sa načítava" />;
  }

  return (
    <div className="business-chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => `${Number(value).toLocaleString('sk-SK')} €`} />
          <Legend />
          <Bar dataKey="orderValue" name="Evidovaná suma (vrátane dopytov)" fill="#6B2D5E" />
          <Bar dataKey="costs" name="Zadané priame náklady a odmeny" fill="#C0392B" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
