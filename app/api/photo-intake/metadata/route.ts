import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updatePhotoIntakeMetadata } from '@/src/server/db';
import { currentPhotoUploadInvite } from '@/src/server/photo-intake-auth';
import { isApproximateLocality, isPhotoCategory } from '@/src/server/photo-intake-policy';
import { privatePhotoIntakeEnabled } from '@/src/server/photo-intake-config';
import { cleanSlovakText } from '@/src/server/slovak-text';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  id: z.string().uuid(),
  locality: z.string().trim().max(120),
  categories: z.array(z.string().max(40)).max(5),
  expectedMetadataVersion: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Neplatný pôvod požiadavky.' }, { status: 403 });
  if (!privatePhotoIntakeEnabled()) return NextResponse.json({ error: 'Súkromné nahrávanie ešte nie je zapnuté.' }, { status: 503 });
  const invite = await currentPhotoUploadInvite();
  if (!invite) return NextResponse.json({ error: 'Nahrávacia relácia už nie je platná.' }, { status: 401 });

  try {
    const payload = payloadSchema.parse(await request.json());
    if (payload.locality && !isApproximateLocality(payload.locality)) return NextResponse.json({ error: 'Uveďte iba obec alebo širšiu oblasť, bez ulice a čísla domu.' }, { status: 400 });
    if (payload.categories.some((category) => !isPhotoCategory(category)) || new Set(payload.categories).size !== payload.categories.length) {
      return NextResponse.json({ error: 'Vyberte iba ponúknuté typy objektov.' }, { status: 400 });
    }
    const updated = await updatePhotoIntakeMetadata({
      id: payload.id,
      locality: cleanSlovakText(payload.locality),
      categories: payload.categories,
      updatedBy: `photo-invite:${invite.id}`,
      expectedMetadataVersion: payload.expectedMetadataVersion,
      inviteId: invite.id,
    });
    if (!updated) return NextResponse.json({ error: 'Fotografia sa zmenila alebo už nie je dostupná na úpravu. Obnovte stránku.' }, { status: 409 });
    return NextResponse.json({ ok: true, metadataVersion: updated.metadataVersion });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Skontrolujte lokalitu, kategórie a skúste to znova.' }, { status: 400 });
    return NextResponse.json({ error: 'Popis fotografie sa nepodarilo uložiť. Skúste to neskôr.' }, { status: 503 });
  }
}
