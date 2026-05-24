'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function BusinessChart({ data }: { data: Array<{ month: string; revenue: number; costs: number; profit: number }> }) {
  return (
    <div className="business-chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => `${Number(value).toLocaleString('sk-SK')} €`} />
          <Legend />
          <Bar dataKey="revenue" name="Tržby" fill="#185fa5" />
          <Bar dataKey="profit" name="Zisk" fill="#2d7a3a" />
          <Bar dataKey="costs" name="Náklady" fill="#e8541a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
