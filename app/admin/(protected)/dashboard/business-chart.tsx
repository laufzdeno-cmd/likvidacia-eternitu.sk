'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function BusinessChart({ data }: { data: Array<{ month: string; revenue: number; costs: number; profit: number }> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="business-chart business-chart-placeholder" aria-label="Graf sa načítava" />;
  }

  return (
    <div className="business-chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid stroke="#E3EEF5" strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => `${Number(value).toLocaleString('sk-SK')} €`} />
          <Legend />
          <Bar dataKey="revenue" name="Tržby" fill="#8CC9EE" />
          <Bar dataKey="profit" name="Zisk" fill="#FFC66D" />
          <Bar dataKey="costs" name="Náklady" fill="#C0392B" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
