'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { BusinessJob, PriceOffer, PriceOfferMaterialType, PriceOfferSettings } from '@/src/server/types';
import { calculatePriceOfferPricing } from '@/src/lib/price-offer-pricing';
import { MAX_PRICE_OFFER_NOTE_LENGTH } from '@/src/lib/price-offer-note';
import { calculateTransportDistanceAction } from './actions';
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

function defaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  return date.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function PriceOfferForm({ jobs, settings, offer, selectedJobId }: Props) {
  const selectedJob = jobs.find((job) => job.id === (offer?.jobId || selectedJobId));
  const initialMaterial = offer?.materialType || 'VLNITY_ETERNIT';
  const initialValidUntil = offer?.validUntil || defaultValidUntil();
  const [materialType, setMaterialType] = useState<PriceOfferMaterialType>(initialMaterial);
  const [area, setArea] = useState(offer?.areaM2 ?? selectedJob?.m2 ?? 0);
  const [price, setPrice] = useState(offer?.pricePerM2WithoutVat ?? settings.materialPrices[initialMaterial]);
  const [includeDocumentation, setIncludeDocumentation] = useState(offer?.includeDocumentation ?? true);
  const [documentationPromotion, setDocumentationPromotion] = useState(offer?.documentationPromotion ?? false);
  const [includeTransport, setIncludeTransport] = useState(offer?.includeTransport ?? false);
  const [transportFrom, setTransportFrom] = useState(offer?.transportFrom || 'Poprad');
  const [transportTo, setTransportTo] = useState(offer?.transportTo || selectedJob?.location || '');
  const [transportRoundTripKm, setTransportRoundTripKm] = useState(offer?.transportRoundTripKm ?? 0);
  const [transportPricePerKm, setTransportPricePerKm] = useState(offer?.transportPricePerKm ?? 0.7);
  const [routeError, setRouteError] = useState('');
  const [routePending, startRouteTransition] = useTransition();
  const routeRequestId = useRef(0);
  const [documentation, setDocumentation] = useState(offer?.documentationFeeWithoutVat ?? settings.documentationFee);
  const [validUntil, setValidUntil] = useState(initialValidUntil);
  const vatRate = offer?.vatRate ?? settings.vatRate;
  const areaIsUnknown = area <= 0;

  const totals = useMemo(() => {
    const pricing = calculatePriceOfferPricing({ areaM2: area, pricePerM2WithoutVat: price,
      documentationFeeWithoutVat: documentation, includeDocumentation, documentationPromotion,
      includeTransport, transportRoundTripKm, transportPricePerKm }, vatRate);
    return { material: pricing.materialPriceWithoutVat, docs: pricing.documentationWithoutVat,
      transport: pricing.transportWithoutVat, withoutVat: pricing.totalWithoutVat,
      vat: Math.round((pricing.totalWithVat - pricing.totalWithoutVat) * 100) / 100, withVat: pricing.totalWithVat };
  }, [area, documentation, documentationPromotion, includeDocumentation, includeTransport, price, vatRate, transportPricePerKm, transportRoundTripKm]);

  useEffect(() => () => { routeRequestId.current += 1; }, []);

  function calculateRoute() {
    setRouteError('');
    const requestId = ++routeRequestId.current;
    const origin = transportFrom;
    const destination = transportTo;
    startRouteTransition(async () => {
      const formData = new FormData();
      formData.set('_csrf', document.getElementById('admin-csrf-token')?.getAttribute('data-token') || '');
      formData.set('origin', origin);
      formData.set('destination', destination);
      const result = await calculateTransportDistanceAction(formData);
      if (requestId !== routeRequestId.current) return;
      if (result.distanceKm !== undefined) setTransportRoundTripKm(result.distanceKm);
      else setRouteError(result.error || 'Kilometre sa nepodarilo vypočítať.');
    });
  }

  return (
    <div className="price-offer-layout">
      <div className="price-offer-main">
        <section className="admin-card">
          <h2>Zákazka</h2>
          <div className="admin-quote-form">
            <label>
              Číslo ponuky
              <input value={offer?.number || 'Vygeneruje sa po uložení'} readOnly />
            </label>
            <label className="admin-form-wide">
              Prepojenie na zákazku
              <select name="jobId" defaultValue={offer?.jobId || selectedJobId || ''}>
                <option value="">Bez prepojenia</option>
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.customerName} · {job.location} · {job.m2 > 0 ? `${job.m2} m2` : 'výmera neznáma'}</option>)}
              </select>
            </label>
          </div>
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
            <label className="admin-form-wide">Termín realizácie<input name="realizationTerm" maxLength={250} defaultValue={offer?.realizationTerm || selectedJob?.term || 'dohodou – po splnení potrebného postupu pred prácami'} /></label>
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
            <label>Výmera m2<input name="areaM2" type="number" min="0.01" step="0.01" value={area || ''} onChange={(event) => setArea(n(event.target.value))} required />{areaIsUnknown ? <small>Výmera nie je vyplnená. Pred uložením ponuky ju doplňte.</small> : null}</label>
            <label>Cena za m2 bez DPH<input name="pricePerM2WithoutVat" type="number" step="0.01" value={price || ''} onChange={(event) => setPrice(n(event.target.value))} required /></label>
            <label className="admin-checkbox"><input name="includeDocumentation" type="checkbox" checked={includeDocumentation} onChange={(event) => setIncludeDocumentation(event.target.checked)} /> Zahrnúť dokumentáciu</label>
            <label>Cena dokumentácia bez DPH<input name="documentationFeeWithoutVat" type="number" step="0.01" value={documentation || ''} onChange={(event) => setDocumentation(n(event.target.value))} readOnly={!includeDocumentation || documentationPromotion} /></label>
            {includeDocumentation ? <label className="admin-checkbox"><input name="documentationPromotion" type="checkbox" checked={documentationPromotion} onChange={(event) => setDocumentationPromotion(event.target.checked)} /> Akcia: dokumentácia za 0 €</label> : null}
            <label className="admin-checkbox"><input name="includeTransport" type="checkbox" checked={includeTransport} onChange={(event) => setIncludeTransport(event.target.checked)} /> Účtovať dopravu</label>
            {includeTransport ? <>
              <label>Odkiaľ<input name="transportFrom" value={transportFrom} onChange={(event) => { routeRequestId.current += 1; setTransportFrom(event.target.value); }} maxLength={250} required /></label>
              <label>Kam<input name="transportTo" value={transportTo} onChange={(event) => { routeRequestId.current += 1; setTransportTo(event.target.value); }} maxLength={250} required /></label>
              <div className="admin-form-wide" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 12 }}>
                <button className="admin-secondary-link" type="button" onClick={calculateRoute} disabled={routePending || !transportFrom.trim() || !transportTo.trim()}>{routePending ? 'Počítam trasu…' : 'Vypočítať km tam aj späť'}</button>
                <span className="muted">Vzdialenosť a sadzbu môžete upraviť ručne.</span>
              </div>
              {routeError ? <p className="admin-alert is-error admin-form-wide" role="status">{routeError}</p> : null}
              <label>Celkom tam aj späť (km)<input name="transportRoundTripKm" type="number" min="0" max="4000" step="0.01" value={transportRoundTripKm || ''} onChange={(event) => { routeRequestId.current += 1; setTransportRoundTripKm(n(event.target.value)); }} required /></label>
              <label>Cena za km bez DPH<input name="transportPricePerKm" type="number" min="0" max="100" step="0.01" value={transportPricePerKm} onChange={(event) => setTransportPricePerKm(n(event.target.value))} required /></label>
            </> : <>
              <input type="hidden" name="transportFrom" value={transportFrom} /><input type="hidden" name="transportTo" value={transportTo} />
              <input type="hidden" name="transportRoundTripKm" value={transportRoundTripKm} /><input type="hidden" name="transportPricePerKm" value={transportPricePerKm} />
            </>}
          </div>
        </section>

        <section className="admin-card">
          <h2>Ďalšie</h2>
          <div className="admin-quote-form">
            <label>
              Platná do
              <input name="validUntil" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} required />
              <small>Zobrazí sa ako: {displayDate(validUntil)}</small>
            </label>
            <label className="admin-form-wide">Poznámka do ponuky<textarea name="offerNote" rows={4} maxLength={MAX_PRICE_OFFER_NOTE_LENGTH} defaultValue={offer?.offerNote || ''} /><small>Najviac {MAX_PRICE_OFFER_NOTE_LENGTH} znakov.</small></label>
            <label className="admin-form-wide">Interná poznámka<textarea name="internalNote" rows={4} defaultValue={offer?.internalNote || ''} /></label>
            <input type="hidden" name="sourceInquiry" value={offer?.sourceInquiry || selectedJob?.leadSource || 'likvidacia-eternitu.sk'} />
          </div>
        </section>
      </div>

      <aside className="price-offer-summary">
        {offer ? <input type="hidden" name="id" value={offer.id} /> : null}
        <p>Kalkulácia</p>
        <h2>{offer?.number ? `CP ${offer.number}` : 'Nová ponuka'}</h2>
        <dl>
          <dt>Materiál</dt>
          <dd>{areaIsUnknown ? 'Výmera neznáma' : <>{area} m2 × {euro(price)} = {euro(totals.material)}</>}</dd>
          <dt>Dokumentácia</dt>
          <dd>{includeDocumentation && documentationPromotion ? <><del>{euro(documentation)}</del> AKCIA 0,00 €</> : euro(totals.docs)}</dd>
          {includeTransport ? <><dt>Doprava ({transportRoundTripKm} km × {euro(transportPricePerKm)}/km)</dt><dd>{euro(totals.transport)}</dd></> : null}
          <dt>Bez DPH</dt>
          <dd>{euro(totals.withoutVat)}</dd>
          <dt>DPH {vatRate}%</dt>
          <dd>{euro(totals.vat)}</dd>
        </dl>
        <div className="price-offer-total">
          <span>S DPH</span>
          <strong>{euro(totals.withVat)}</strong>
        </div>
        <div className="price-offer-actions">
          <button className="admin-secondary-link" type="submit">{offer ? 'Uložiť zmeny' : 'Uložiť ako koncept'}</button>
          <button className="admin-primary-button" type="submit" name="next" value="send">Uložiť a skontrolovať odoslanie</button>
        </div>
      </aside>
    </div>
  );
}
