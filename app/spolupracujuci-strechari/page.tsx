import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Spolupracujúci strechári | ASTANA', description: 'Informácie o zladení likvidácie eternitu so strechármi.' };

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
