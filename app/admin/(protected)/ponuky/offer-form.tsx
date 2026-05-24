'use client';

import { useMemo, useState } from 'react';
import type { BusinessJob, PriceOffer, PriceOfferMaterialType, PriceOfferSettings } from '@/src/server/types';
import { euro, priceOfferMaterialLabels } from './constants';

type Props = {
  jobs: BusinessJob[];
  settings: PriceOfferSettings;
  offer?: PriceOffer;
  selectedJobId?: string;
};

function n(value: string | number | undefined) {
  return Number(String(value ?? '').replace(',', '.')) || 0;
}

function validUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  return date.toISOString().slice(0, 10);
}

export default function PriceOfferForm({ jobs, settings, offer, selectedJobId }: Props) {
  const selectedJob = jobs.find((job) => job.id === (offer?.jobId || selectedJobId));
  const initialMaterial = offer?.materialType || 'VLNITY_ETERNIT';
  const [materialType, setMaterialType] = useState<PriceOfferMaterialType>(initialMaterial);
  const [area, setArea] = useState(offer?.areaM2 ?? selectedJob?.m2 ?? 0);
  const [price, setPrice] = useState(offer?.pricePerM2WithoutVat ?? settings.materialPrices[initialMaterial]);
  const [includeDocumentation, setIncludeDocumentation] = useState(offer?.includeDocumentation ?? true);
  const [documentation, setDocumentation] = useState(offer?.documentationFeeWithoutVat ?? settings.documentationFee);

  const totals = useMemo(() => {
    const material = Math.round(area * price * 100) / 100;
    const docs = includeDocumentation ? documentation : 0;
    const withoutVat = Math.round((material + docs) * 100) / 100;
    const vat = Math.round(withoutVat * (settings.vatRate / 100) * 100) / 100;
    return { material, docs, withoutVat, vat, withVat: Math.round((withoutVat + vat) * 100) / 100 };
  }, [area, documentation, includeDocumentation, price, settings.vatRate]);

  return (
    <div className="business-form">
      {offer ? <input type="hidden" name="id" value={offer.id} /> : null}
      <section className="admin-card">
        <h2>Zákazka</h2>
        <label>
          Prepojenie na zákazku
          <select name="jobId" defaultValue={offer?.jobId || selectedJobId || ''}>
            <option value="">Bez prepojenia</option>
            {jobs.map((job) => <option key={job.id} value={job.id}>{job.customerName} · {job.location} · {job.m2} m²</option>)}
          </select>
        </label>
      </section>

      <section className="admin-card">
        <h2>Objekt a kontakt</h2>
        <div className="admin-quote-form">
          <label>Typ objektu<input name="objectType" defaultValue={offer?.objectType || selectedJob?.objectType || 'Rodinný dom'} required /></label>
          <label>Adresa objektu<input name="objectAddress" defaultValue={offer?.objectAddress || selectedJob?.location || ''} required /></label>
          <label>Obec<input name="municipality" defaultValue={offer?.municipality || selectedJob?.location || ''} required /></label>
          <label>Okres<input name="district" defaultValue={offer?.district || selectedJob?.district || ''} /></label>
          <label>Kontaktná osoba<input name="contactPerson" defaultValue={offer?.contactPerson || selectedJob?.customerName || ''} required /></label>
          <label>Telefón<input name="phone" type="tel" defaultValue={offer?.phone || selectedJob?.customerPhone || ''} required /></label>
          <label>Email<input name="email" type="email" defaultValue={offer?.email || selectedJob?.customerEmail || ''} required /></label>
          <label className="admin-form-wide">Termín realizácie<input name="realizationTerm" defaultValue={offer?.realizationTerm || selectedJob?.term || 'dohodou - po vydaní rozhodnutí z úradov'} /></label>
        </div>
      </section>

      <section className="admin-card">
        <h2>Materiál a cena</h2>
        <div className="admin-quote-form">
          <label>
            Typ materiálu
            <select
              name="materialType"
              value={materialType}
              onChange={(event) => {
                const next = event.target.value as PriceOfferMaterialType;
                setMaterialType(next);
                setPrice(settings.materialPrices[next]);
              }}
            >
              {Object.entries(priceOfferMaterialLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>Výmera m²<input name="areaM2" type="number" step="0.01" value={area || ''} onChange={(event) => setArea(n(event.target.value))} required /></label>
          <label>Cena za m² bez DPH<input name="pricePerM2WithoutVat" type="number" step="0.01" value={price || ''} onChange={(event) => setPrice(n(event.target.value))} required /></label>
          <label className="admin-checkbox"><input name="includeDocumentation" type="checkbox" checked={includeDocumentation} onChange={(event) => setIncludeDocumentation(event.target.checked)} /> Zahrnúť dokumentáciu</label>
          <label>Cena dokumentácia bez DPH<input name="documentationFeeWithoutVat" type="number" step="0.01" value={documentation || ''} onChange={(event) => setDocumentation(n(event.target.value))} /></label>
        </div>
      </section>

      <section className="admin-card">
        <h2>Výpočty</h2>
        <dl className="admin-dl">
          <dt>Materiál</dt><dd>{area} m² × {euro(price)} = {euro(totals.material)} bez DPH</dd>
          <dt>Dokumentácia</dt><dd>{euro(totals.docs)} bez DPH</dd>
          <dt>CELKOM bez DPH</dt><dd><strong>{euro(totals.withoutVat)}</strong></dd>
          <dt>DPH {settings.vatRate}%</dt><dd>{euro(totals.vat)}</dd>
          <dt>CELKOM s DPH</dt><dd><strong>{euro(totals.withVat)}</strong></dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>Ďalšie</h2>
        <div className="admin-quote-form">
          <label>Platná do<input name="validUntil" type="date" defaultValue={offer?.validUntil || validUntil()} required /></label>
          <label className="admin-form-wide">Poznámka do ponuky<textarea name="offerNote" rows={4} defaultValue={offer?.offerNote || ''} /></label>
          <label className="admin-form-wide">Interná poznámka<textarea name="internalNote" rows={4} defaultValue={offer?.internalNote || ''} /></label>
          <input type="hidden" name="sourceInquiry" value={offer?.sourceInquiry || selectedJob?.leadSource || 'likvidacia-eternitu.sk'} />
        </div>
      </section>
    </div>
  );
}
