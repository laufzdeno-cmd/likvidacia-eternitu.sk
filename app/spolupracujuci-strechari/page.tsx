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
      lead="Ak strechára nemáte, uveďte kraj a termín v dopyte. Podľa regiónu a kapacity preveríme možnosť odporučiť spolupracujúceho strechára."
      sections={[
        { title: 'Máte svojho strechára', text: 'Zladíme termín demontáže tak, aby strechár mohol plynulo pokračovať.' },
        { title: 'Nemáte strechára', text: 'Podľa kraja, termínu a kapacity preveríme možnosť odporučenia. Dohodu so strechárom robíte vždy priamo vy.' },
        { title: 'Verejné profily až so súhlasom', text: 'Verejne nezobrazujeme prázdny katalóg ani firmy bez samostatne potvrdeného súhlasu so zverejnením.' },
      ]}
    />
  );
}
