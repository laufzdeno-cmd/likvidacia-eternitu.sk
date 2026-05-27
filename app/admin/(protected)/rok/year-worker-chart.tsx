'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function YearWorkerChart({ data, workers }: { data: Array<Record<string, number | string>>; workers: string[] }) {
  const colors = ['#185fa5', '#da251d', '#2d7a3a', '#8a5cf6', '#b7791f'];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => `${Number(value).toLocaleString('sk-SK')} €`} />
        <Legend />
        {workers.map((worker, index) => <Bar key={worker} dataKey={worker} stackId="workers" fill={colors[index % colors.length]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
