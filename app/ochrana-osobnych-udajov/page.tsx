import SimplePublicPage from '../simple-public-page';
import { buildPageMetadata } from '../seo-components';

export const metadata = buildPageMetadata({
  title: 'Ochrana osobných údajov | ASTANA',
  description: 'Informácie o spracovaní osobných údajov pri dopyte na likvidáciu azbestu a eternitu.',
  path: '/ochrana-osobnych-udajov/',
});

export default function PrivacyPage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Ochrana osobných údajov', path: '/ochrana-osobnych-udajov/' }}
      eyebrow="GDPR"
      title="Ochrana osobných údajov"
      lead="Osobné údaje spracúvame primerane a transparentne na vybavenie dopytu, partnerskej registrácie, realizácie zákazky a bezpečnú prevádzku služby."
      sections={[
        {
          title: 'Prevádzkovateľ',
          text: 'ASTANA, s.r.o., Scherffelova 1364/28, Poprad 058 01, IČO: 46 157 701, DIČ: 2023253771, IČ DPH: SK2023253771, email: astana@astana.sk. Toto je zároveň kontaktné miesto pre otázky a uplatnenie práv podľa GDPR.',
        },
        {
          title: 'Aké údaje spracúvame',
          text: 'Pri dopyte spracúvame meno, telefón, email, lokalitu, výmeru, typ materiálu, typ objektu, termín, preferovaný kontakt, poznámku a voliteľné fotky. Pri registrácii strechára aj firmu, IČO, kontaktnú osobu, web, regióny, špecializácie a voľby spolupráce. Pri referencii meno, email, lokalitu, hodnotenie a text. Pri dopyte sa v technických údajoch uchováva aj user-agent pre evidenciu požiadavky; IP adresa sa používa na krátkodobú ochranu proti zneužitiu a nie je analytickým údajom. Fotky sú uložené v neverejnom úložisku.',
        },
        {
          title: 'Účely a právne základy',
          text: 'Údaje z dopytu používame na kroky na vašu žiadosť pred uzatvorením zmluvy, komunikáciu, prípravu ponuky a realizáciu zákazky. Účtovné a súvisiace záznamy spracúvame na splnenie zákonných povinností. Bezpečnosť služby a ochrana pred zneužitím vychádza z oprávneného záujmu. Zverejnenie profilu strechára, zverejnenie referencie a voliteľná analytika alebo marketingové meranie sa opierajú o samostatnú voľbu, ak sa uplatnia.',
        },
        {
          title: 'Ako dlho ich uchovávame',
          text: 'Podľa retenčného pravidla dopyt bez zákazky uchovávame 6 mesiacov, zákazku 5 rokov z dôvodu daňových a účtovných povinností a analytické záznamy najviac 12 mesiacov. Po uplynutí lehoty údaje vymažeme alebo anonymizujeme, ak ich ďalšie uchovávanie nevyžaduje zákon alebo preukázateľná ochrana práv.',
        },
        {
          title: 'Vaše práva',
          text: 'Máte právo na prístup, opravu, vymazanie, obmedzenie spracovania, prenosnosť údajov a právo namietať spracovanie, ak sa uplatní. Súhlas môžete odvolať rovnako jednoducho, ako ste ho poskytli. O uplatnenie práva požiadajte na astana@astana.sk. Ak sa domnievate, že je spracovanie v rozpore s pravidlami, môžete podať sťažnosť na Úrad na ochranu osobných údajov Slovenskej republiky.',
        },
        {
          title: 'Komu údaje poskytujeme',
          text: 'V nevyhnutnom rozsahu môžeme údaje sprístupniť prepravcom, skládkam, účtovníctvu, hostingu, databáze, neverejnému úložisku súborov, emailovému poskytovateľovi a technickým dodávateľom. Pri plánovaní termínu môže server poslať adresu do služby Nominatim na určenie súradníc a do Open-Meteo na predpoveď počasia. Prevádzkovateľ musí pri konkrétnych poskytovateľoch evidovať zmluvné podmienky a prípadné prenosy mimo EHP.',
        },
        {
          title: 'Cookies a analytika',
          text: 'Stránka používa nevyhnutné nastavenie súhlasu a po voľbe „Prijať všetky“ aj voliteľnú first-party analytiku bez ukladania IP adresy do analytických záznamov. Marketingové meranie a Meta udalosť sa nesmú spustiť bez príslušnej voľby. Voľba „Len nevyhnutné“ voliteľné meranie vypne. Nepoužívame reklamné ani sledovacie cookies tretích strán ako nevyhnutnú súčasť formulára.',
        },
        {
          title: 'Umelá inteligencia a automatizované kontroly',
          text: 'Na tomto webe nepoužívame OpenAI, Gemini, Claude ani inú externú AI službu na spracovanie dopytov, fotografií, cenotvorbu, výber strechára alebo rozhodovanie o prijatí či odmietnutí dopytu. Orientačná kalkulačka používa pevne nastavený výpočet a dopyty posudzuje človek. Preto sa na aktuálny web nevzťahuje povinnosť označovať AI komunikáciu alebo AI výstupy podľa tejto prevádzky; ak sa AI neskôr pridá, túto informáciu aktualizujeme pred jej použitím.',
        },
      ]}
    />
  );
}
