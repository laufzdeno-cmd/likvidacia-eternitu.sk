import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Realizácie | ASTANA', description: 'Informácie o realizáciách likvidácie azbestu a eternitu.' };

export default function RealizationsPage() {
  return (
    <SimplePublicPage
      eyebrow="Realizácie"
      title="Realizácie pripravujeme na zverejnenie"
      lead="Verejne zverejníme iba také realizácie a fotky, ktoré sú schválené a neobsahujú súkromné údaje zákazníkov."
      sections={[
        { title: 'Fotky pred publikovaním', text: 'Fotky z realizácií musia byť schválené pred verejným použitím.' },
        { title: 'Ochrana súkromia', text: 'Lokalitu uvádzame len všeobecne, bez presných adries.' },
        { title: 'Dopyt', text: 'Ak chcete naceniť vlastnú strechu, pošlite fotky cez formulár.' },
      ]}
    />
  );
}
