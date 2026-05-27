import SimplePublicPage from '../simple-public-page';
import { buildPageMetadata } from '../seo-components';

export const metadata = buildPageMetadata({
  title: 'Spolupracujúci strechári a výmena strechy | ASTANA',
  description: 'Ako ASTANA zlaďuje likvidáciu eternitu so strechármi a čo uviesť v dopyte, ak ešte nemáte strechára.',
  path: '/spolupracujuci-strechari/',
});

export default function PartnerRoofersPage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Spolupracujúci strechári', path: '/spolupracujuci-strechari/' }}
      eyebrow="Strechári"
      title="Potrebujete strechára?"
      lead="Ak strechára nemáte, uveďte kraj a termín v dopyte. Preveríme vhodného spolupracujúceho partnera podľa dostupnosti."
      sections={[
        { title: 'Máte svojho strechára', text: 'Zladíme termín demontáže tak, aby strechár mohol plynulo pokračovať.' },
        { title: 'Nemáte strechára', text: 'Podľa kraja a termínu preveríme dostupného partnera.' },
        { title: 'Bez katalógu bez dát', text: 'Verejne nezobrazujeme prázdny katalóg partnerov bez overených údajov.' },
      ]}
    />
  );
}
