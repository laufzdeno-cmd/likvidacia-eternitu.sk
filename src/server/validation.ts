import { z } from 'zod';

export const leadSchema = z.object({
  fullName: z.string().trim().min(2, 'Zadajte meno a priezvisko.').max(120),
  phone: z.string().trim().min(7, 'Zadajte telefónne číslo.').max(40),
  email: z.string().trim().email('Zadajte platný email.').max(160),
  city: z.string().trim().min(2, 'Zadajte obec alebo mesto.').max(120),
  district: z.string().trim().max(120).optional().or(z.literal('')),
  objectType: z.string().trim().min(2, 'Vyberte typ objektu.').max(120),
  materialType: z.string().trim().min(2, 'Vyberte typ materiálu.').max(160),
  areaEstimate: z.coerce.number().positive('Zadajte približnú výmeru.').max(100000),
  roofer: z.string().trim().max(160).optional().or(z.literal('')),
  term: z.string().trim().max(160).optional().or(z.literal('')),
  note: z.string().trim().max(3000).optional().or(z.literal('')),
  gdpr: z.union([z.literal('on'), z.literal('true'), z.literal(true)]),
  companyWebsite: z.string().max(0).optional().or(z.literal('')),
});

export const quoteSchema = z.object({
  areaEstimate: z.coerce.number().positive().max(100000),
  pricePerM2: z.coerce.number().min(0).max(100000),
  documentationFee: z.coerce.number().min(0).max(100000),
  transportFee: z.coerce.number().min(0).max(100000),
  surcharge: z.coerce.number().min(0).max(100000),
  discount: z.coerce.number().min(0).max(100000),
  vatRate: z.coerce.number().min(0).max(100),
  validUntil: z.string().trim().min(8).max(20),
  note: z.string().trim().max(3000).optional().or(z.literal('')),
});

export const allowedFileTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export const allowedFileExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.pdf']);
export const maxLeadFiles = 10;
export const maxLeadFileSize = 10 * 1024 * 1024;
