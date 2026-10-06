import { Fragment } from 'react';
import Image from 'next/image';
import localityDataset from '@/src/data/slovakia-locality-points.json';
import { mapPublishedRealizationLocalityPoints } from '@/src/lib/published-realization-locality-points';
import type { PublishedRealizationCase } from '@/src/server/types';
import styles from './approved-case-map.module.css';

type Props = { cases: readonly PublishedRealizationCase[] };
const MIN_MAP_WIDTH_PX = 222;
const MAP_HEIGHT_PER_WIDTH = 7 / 12;
const MARKER_CLEARANCE_PX = 48;

export default function ApprovedCaseMap({ cases }: Props) {
  if (cases.length === 0) return null;

  const points = mapPublishedRealizationLocalityPoints(cases);
  const casesById = new Map(cases.map((item) => [item.id, item]));
  const clusters: { x: number; y: number; cases: PublishedRealizationCase[] }[] = [];
  for (const point of points) {
    const realization = casesById.get(point.caseId);
    if (!realization) continue;
    const cluster = clusters.find((candidate) => {
      const horizontalDistance = Math.abs(point.x - candidate.x) / 720 * MIN_MAP_WIDTH_PX;
      const verticalDistance = Math.abs(point.y - candidate.y) / 420 * MIN_MAP_WIDTH_PX * MAP_HEIGHT_PER_WIDTH;
      return horizontalDistance < MARKER_CLEARANCE_PX && verticalDistance < MARKER_CLEARANCE_PX;
    }) ?? { x: point.x, y: point.y, cases: [] };
    cluster.cases.push(realization);
    if (!clusters.includes(cluster)) clusters.push(cluster);
  }

  return (
    <section className={styles.section} aria-labelledby="approved-case-map-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Overené prípady z praxe</p>
        <h2 id="approved-case-map-title">Konkrétne práce, nie iba sľuby</h2>
        <p>Nižšie nájdeš zverejnené realizácie ASTANA. Každá bola skontrolovaná pred publikovaním.</p>
      </div>

      {points.length > 0 ? (
        <div className={styles.mapBlock}>
          <div className={styles.map}>
            <Image src="/assets/maps/slovakia-admin-3.svg" alt="" fill sizes="(max-width: 760px) 100vw, 760px" unoptimized aria-hidden="true" />
            <nav className={styles.markerLinks} aria-label="Odkazy na realizácie podľa približnej lokality">
              {clusters.map((cluster) => {
                const firstCase = cluster.cases[0];
                const locality = firstCase.locality || 'potvrdená lokalita';
                const label = cluster.cases.length === 1
                  ? `${firstCase.title}, ${locality} – zobraziť realizáciu`
                  : `${cluster.cases.length} realizácie v blízkych lokalitách – vybrať realizáciu`;
                const markerPosition = { left: `${(cluster.x / 720) * 100}%`, top: `${(cluster.y / 420) * 100}%` };
                if (cluster.cases.length > 1) {
                  return (
                    <Fragment key={`cluster-${firstCase.id}`}>
                    <details
                      className={styles.markerCluster}
                      name="realization-map-clusters"
                      data-side={cluster.x > 520 ? 'left' : 'right'}
                      style={markerPosition}
                    >
                      <summary className={styles.markerLink} aria-label={label} title={label}>
                        <span className={styles.markerCount} aria-hidden="true">{cluster.cases.length}</span>
                      </summary>
                    </details>
                    <ul
                      className={styles.clusterCaseList}
                      data-side={cluster.x > 520 ? 'left' : 'right'}
                      style={{
                        '--cluster-x': `${(cluster.x / 720) * 100}%`,
                        top: `calc(${(cluster.y / 420) * 100}% + 24px)`,
                      } as import('react').CSSProperties}
                    >
                      {cluster.cases.map((item) => (
                        <li key={item.id}>
                          <a href={`#realizacia-${item.id}`}>
                            {item.title}{item.locality ? ` · ${item.locality}` : ''}
                          </a>
                        </li>
                      ))}
                    </ul>
                    </Fragment>
                  );
                }
                return (
                  <a
                    key={`link-${firstCase.id}`}
                    className={styles.markerLink}
                    href={`#realizacia-${firstCase.id}`}
                    aria-label={label}
                    title={label}
                    style={markerPosition}
                  />
                );
              })}
            </nav>
          </div>
          <p className={styles.disclaimer}>Body zobrazujú približnú obec alebo okres. Neoznačujú presnú adresu ani polohu domu.</p>
          <p className={styles.attribution}>
            Podklad: {localityDataset.source}.{' '}
            <a href={localityDataset.sourceUrl} target="_blank" rel="noreferrer">Zdroj mapových údajov</a>. Licencia{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{localityDataset.license}</a>.
          </p>
        </div>
      ) : (
        <p className={styles.disclaimer}>Mapu zobrazíme pri prípadoch s bezpečne potvrdenou obcou alebo okresom. Nejednoznačnú lokalitu radšej neumiestňujeme.</p>
      )}

      <div className={`${styles.cards} ${cases.length === 1 ? styles.cardsOne : cases.length === 2 ? styles.cardsTwo : ''}`}>
        {cases.map((item) => {
          const pointAvailable = points.some((point) => point.caseId === item.id);
          const imageId = item.photoIds[0];
          const localityLabel = item.localityPrecision === 'municipality' ? 'obec' : item.localityPrecision === 'district' ? 'okres' : 'lokalita';
          return (
            <article className={styles.card} id={`realizacia-${item.id}`} key={item.id}>
              {imageId ? (
                <Image
                  src={`/api/realization-case-media/${encodeURIComponent(imageId)}`}
                  alt={`${item.objectType} – ${item.materialType}${item.locality ? `, ${item.locality}` : ''}`}
                  width={720}
                  height={480}
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  unoptimized
                />
              ) : null}
              <div className={styles.cardBody}>
                <p className={styles.locality}>{item.locality || 'Slovensko'}{item.locality ? ` · ${localityLabel}` : ''}{pointAvailable ? ' · približná poloha na mape' : ''}</p>
                <h3>{item.title}</h3>
                <p className={styles.summary}>{item.workDescription}</p>
                <dl>
                  <div><dt>Objekt a materiál</dt><dd>{item.objectType} · {item.materialType}</dd></div>
                  <div><dt>Výsledok</dt><dd>{item.resultDescription}</dd></div>
                  {item.areaEstimate ? <div><dt>Približná výmera</dt><dd>{item.areaEstimate} m²</dd></div> : null}
                  {item.workPeriod ? <div><dt>Obdobie realizácie</dt><dd>{item.workPeriod}</dd></div> : null}
                </dl>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
