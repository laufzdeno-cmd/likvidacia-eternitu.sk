import { createHash } from 'node:crypto';
import type { CustomerDirectoryRecordLink, CustomerDirectorySummary } from './types';

export type CustomerDirectorySourceRecord = {
  kind: 'inquiry' | 'job' | 'offer';
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  activityAt: string;
  label: string;
  href: string;
};

type MutableCustomerGroup = {
  id: number;
  records: CustomerDirectorySourceRecord[];
};

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sk-SK')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCustomerEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeCustomerPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('421')) return `0${digits.slice(3)}`;
  if (digits.length === 9 && digits.startsWith('9')) return `0${digits}`;
  return digits;
}

function linkFor(record: CustomerDirectorySourceRecord): CustomerDirectoryRecordLink {
  return { id: record.id, label: record.label, href: record.href, activityAt: record.activityAt };
}

function newestNonEmpty(records: CustomerDirectorySourceRecord[], field: 'name' | 'email' | 'phone' | 'location') {
  return records.find((record) => record[field].trim())?.[field].trim() ?? '';
}

function groupKey(records: CustomerDirectorySourceRecord[]) {
  const identities = records.flatMap((record) => {
    const email = normalizeCustomerEmail(record.email);
    const phone = normalizeCustomerPhone(record.phone);
    return [email ? `e:${email}` : '', phone ? `p:${phone}` : ''].filter(Boolean);
  }).sort();
  const fallback = records.map((record) => `${record.kind}:${record.id}`).sort()[0] ?? 'empty';
  return createHash('sha256').update(identities[0] ?? fallback).digest('hex').slice(0, 20);
}

function mergeGroups(target: MutableCustomerGroup, source: MutableCustomerGroup, groups: Set<MutableCustomerGroup>) {
  if (target === source) return target;
  target.records.push(...source.records);
  groups.delete(source);
  return target;
}

export function buildCustomerDirectory(records: CustomerDirectorySourceRecord[], query = ''): CustomerDirectorySummary[] {
  const emailGroups = new Map<string, MutableCustomerGroup>();
  const phoneGroups = new Map<string, MutableCustomerGroup>();
  const groups = new Set<MutableCustomerGroup>();
  let nextId = 1;

  for (const record of records) {
    const email = normalizeCustomerEmail(record.email);
    const phone = normalizeCustomerPhone(record.phone);
    const byEmail = email ? emailGroups.get(email) : undefined;
    const byPhone = phone ? phoneGroups.get(phone) : undefined;
    let group = byEmail ?? byPhone;
    if (!group) {
      group = { id: nextId++, records: [] };
      groups.add(group);
    }
    if (byEmail && byPhone && byEmail !== byPhone) {
      const target = byEmail.records.length >= byPhone.records.length ? byEmail : byPhone;
      const source = target === byEmail ? byPhone : byEmail;
      group = mergeGroups(target, source, groups);
      for (const merged of source.records) {
        const mergedEmail = normalizeCustomerEmail(merged.email);
        const mergedPhone = normalizeCustomerPhone(merged.phone);
        if (mergedEmail) emailGroups.set(mergedEmail, group);
        if (mergedPhone) phoneGroups.set(mergedPhone, group);
      }
    }
    group.records.push(record);
    if (email) emailGroups.set(email, group);
    if (phone) phoneGroups.set(phone, group);
  }

  const normalizedQuery = normalizeSearch(query);
  return [...groups]
    .map((group) => {
      const ordered = [...group.records].sort((a, b) => b.activityAt.localeCompare(a.activityAt));
      const unique = (kind: CustomerDirectorySourceRecord['kind']) => {
        const seen = new Set<string>();
        return ordered
          .filter((record) => {
            if (record.kind !== kind || seen.has(record.id)) return false;
            seen.add(record.id);
            return true;
          })
          .map(linkFor);
      };
      return {
        key: groupKey(ordered),
        name: newestNonEmpty(ordered, 'name') || 'Nepomenovaný klient',
        email: newestNonEmpty(ordered, 'email'),
        phone: newestNonEmpty(ordered, 'phone'),
        location: newestNonEmpty(ordered, 'location'),
        latestActivityAt: ordered[0]?.activityAt ?? new Date(0).toISOString(),
        inquiries: unique('inquiry'),
        jobs: unique('job'),
        offers: unique('offer'),
      } satisfies CustomerDirectorySummary;
    })
    .filter((customer) => !normalizedQuery || normalizeSearch([
      customer.name,
      customer.email,
      customer.phone,
      customer.location,
      ...customer.inquiries.map((item) => item.label),
      ...customer.jobs.map((item) => item.label),
      ...customer.offers.map((item) => item.label),
    ].join(' ')).includes(normalizedQuery))
    .sort((a, b) => b.latestActivityAt.localeCompare(a.latestActivityAt));
}
