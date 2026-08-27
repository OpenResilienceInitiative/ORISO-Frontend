/**
 * Tigrinya. Machine-translated from `de-sie`, not yet read by a native speaker.
 *
 * Of the five languages this is the one with the widest gap between "a machine
 * produced it" and "a person can vouch for it": there is no fallback reviewer
 * on the team, and no member of the team can spot a wrong claim by reading it.
 * Treat every string here as unverified until `translationReview.json` says
 * otherwise. See `translationManifest.json` for what this was translated from.
 *
 * Script and direction: Ge'ez (Ethiopic), written **left to right**. Tigrinya
 * is not an RTL language, so nothing in the kit needs a mirrored layout — see
 * `EMAIL_LOCALE_DIR` in the catalogue, which states that for every locale
 * rather than leaving it assumed.
 *
 * Terminology, decided once so the 22 occasions agree with each other:
 *   Beratung            → ኣገልግሎት ምኽሪ (the relationship), ምኽሪ (the session)
 *   Beratungsstelle     → ማእከል ምኽሪ
 *   Fachkraft           → ክኢላ
 *   Träger              → ትካል
 *   ratsuchende Person  → ምኽሪ ዝሓትት ሰብ
 *   Fachaustausch       → ሞያዊ ልውውጥ
 *   AVV                 → ውዕል ኣተሓሕዛ ዳታ
 *
 * The address form is the formal plural throughout.
 */

import { EmailContent } from '../kit/emailTemplate';
import { EmailId } from './emailCatalogue';

const footer = {
	offeredBy: '{{platformName}} ብ{{orgName}} ዝቐርብ ኣገልግሎት እዩ።',
	links: [
		{ label: 'ቅንብራት', href: '{{settingsUrl}}' },
		{ label: 'ሓለዋ ዳታ', href: '{{privacyUrl}}' },
		{ label: 'ሕጋዊ ሓበሬታ', href: '{{imprintUrl}}' },
		{ label: 'መፍለጢታት ሰርዙ', href: '{{unsubscribeUrl}}' }
	],
	automatedNote: 'እዛ ኢመይል ብስርዓት ብቐጥታ ተላኢኻ እያ። በጃኹም ኣይትምለስዋ።'
};

const assurance =
	'መልእኽትታትኩም ካብ ጫፍ ናብ ጫፍ ተመስጢሮም እዮም። ብጀካኹምን ኣገልግሎት ምኽርኹምን ዝኾነ ሰብ ከንብቦም ኣይክእልን – ንሕና እውን ኣይንኽእልን።';

/** See `de-sie` — no unsubscribe link, because nothing switches these off. */
const securityFooter = {
	offeredBy: '{{platformName}} ብ{{orgName}} ዝቐርብ ኣገልግሎት እዩ።',
	links: [
		{ label: 'ሓለዋ ዳታ', href: '{{privacyUrl}}' },
		{ label: 'ሕጋዊ ሓበሬታ', href: '{{imprintUrl}}' }
	],
	automatedNote: 'እዛ ኢመይል ናይ ምእታው ኣካል ስለዝኾነት ክትስረዝ ኣይትኽእልን። በጃኹም ኣይትምለስዋ።'
};

const legalFooter = {
	...securityFooter,
	automatedNote: 'እዛ ኢመይል ናይ ውዕላዊ ርክብ ኣካል ስለዝኾነት ክትስረዝ ኣይትኽእልን። በጃኹም ኣይትምለስዋ።'
};

const staffAssurance =
	'ትሕዝቶ ምኽሪ ፈጺሙ ኣብ ኢመይል ኣይስፍርን። ድሕሪ ምእታውኩም ጥራይ ተመስጢሩ ትርእይዎ።';

const securityAssurance =
	'መሕለፊ ቃልኩም ብኢመይል ፈጺምና ኣይንሓትትን። ነዚ መላግቦ ንዝኾነ ሰብ ኣይትሃብዎ።';

const codeAssurance = 'መሕለፊ ቃልኩም ብኢመይል ፈጺምና ኣይንሓትትን። ነዚ ኮድ ንዝኾነ ሰብ ኣይትሃብዎ።';

const accountAssurance =
	'መሕለፊ ቃልኩም ብኢመይል ፈጺምና ኣይንሓትትን። ኣብ መእተዊኹም ዝግበር ለውጢ ወትሩ ንሕብረኩም።';

const legalAssurance =
	'እዛ ኢመይል ኣብ መንጎ {{orgName}}ን {{tenantName}}ን ዘሎ ውዕላዊ ርክብ እትምልከት እያ።';

export const ti: Record<EmailId, EmailContent> = {
	'neue-nachricht': {
		subject: 'ሓድሽ መልእኽቲ በጺሑኩም ኣሎ',
		preheader: 'ኣብ ምኽርኹም ሓድሽ መልእኽቲ ይጽበየኩም ኣሎ።',
		headline: 'ሓድሽ መልእኽቲ በጺሑኩም ኣሎ',
		paragraphs: [
			'ኣብ {{platformName}} ዘሎ ኣገልግሎት ምኽርኹም ሓድሽ መልእኽቲ ይጽበየኩም ኣሎ።',
			'ብምኽንያት ሓለዋ ዳታ ኣብዚ ትሕዝቶ ኮነ ስም ኣይነርእን። ነቲ መልእኽቲ ድሕሪ ምእታውኩም ተመስጢሩ ተንብብዎ።'
		],
		cta: { label: 'ናብቲ መልእኽቲ', href: '{{messageUrl}}' },
		footnote: 'ብኡንብኡ ክትምልሱ ኣየድልየኩምን። እቲ መልእኽቲ ክሳብ ዘድልየኩም ኣብ ሳጹንኩም ይጸንሕ።',
		assurance,
		footer
	},

	'willkommen': {
		subject: 'እንኳዕ ናብ {{platformName}} ብደሓን መጻእኩም',
		preheader: 'ስም ኣልቦ መእተዊኹም ተዳልዩ ኣሎ – ቀጺሉ ዘሎ ስጉምቲ እዚ እዩ።',
		headline: 'መእተዊኹም ተዳልዩ ኣሎ',
		paragraphs: [
			'ኣብ {{platformName}} ብስም ኣልቦ ተመዝጊብኩም ኣለኹም። ብምምጻእኩም ተሓጒስና።',
			'በጃኹም ስም ተጠቃሚኹም ብጥንቃቐ ሓዝዎ። ብምኽንያት ሓለዋ ዳታ ክንመልሶ ኣይንኽእልን።'
		],
		panel: [{ label: 'ስም ተጠቃሚ', value: '{{username}}' }],
		cta: { label: 'ናብ ምኽሪ እቶዉ', href: '{{loginUrl}}' },
		footnote: 'ኣማኻሪኹም ኣብ ውሽጢ 2 ናይ ስራሕ መዓልትታት ይምልሰልኩም።',
		assurance,
		footer
	},

	'passwort-zuruecksetzen': {
		subject: 'ሓድሽ መሕለፊ ቃል ኣቐምጡ',
		preheader: 'እቲ መላግቦ ን{{expiryHours}} ሰዓታት ይሰርሕ።',
		headline: 'ሓድሽ መሕለፊ ቃል ኣቐምጡ',
		paragraphs: [
			'ኣብ {{platformName}} ንዘለኩም መእተዊ ሓድሽ መሕለፊ ቃል ሓቲትኩም ኣለኹም።',
			'እቲ መላግቦ ን{{expiryHours}} ሰዓታት ይሰርሕ፣ ሓንሳብ ጥራይ ድማ ክውዕል ይኽእል።'
		],
		cta: { label: 'መሕለፊ ቃል ኣሐድሱ', href: '{{resetUrl}}' },
		footnote: 'ንስኹም ዘይሓተትኩምዎ እንተኾይኑ፣ ነዛ ኢመይል ግደፍዋ። መሕለፊ ቃልኩም ከምዘሎ ይጸንሕ።',
		assurance,
		footer
	},

	'termin': {
		subject: 'ቆጸራኹም ኣብ {{appointmentDate}}',
		preheader:
			'{{appointmentDate}}፣ {{appointmentTime}} – {{appointmentType}}።',
		headline: 'ቆጸራኹም ተረጋጊጹ ኣሎ',
		paragraphs: ['ቆጸራኹም መዝጊብናዮ ኣለና። ዘድሊ ምድላው የብልኩምን – ከምዘለኹም ምጹ።'],
		panel: [
			{ label: 'ዕለት', value: '{{appointmentDate}}' },
			{ label: 'ሰዓት', value: '{{appointmentTime}}' },
			{ label: 'ዓይነት', value: '{{appointmentType}}' },
			{ label: 'ቦታ', value: '{{locationName}}<br>{{locationAddress}}' }
		],
		cta: { label: 'ቆጸራ ተመልከቱ', href: '{{appointmentUrl}}' },
		secondaryAction: {
			label: 'ነቲ ኣድራሻ ኣብ ካርታ ክፈትዎ',
			href: '{{mapUrl}}'
		},
		footnote: 'ቅድሚ 24 ሰዓታት መዘኻኸሪ ይመጸኩም። ኣብ ዝኾነ እዋን ክትስርዝዎ ትኽእሉ።',
		assurance,
		footer
	},

	'beraterin-kontakt': {
		subject: 'ንኣገልግሎት ምኽርኹም ብኸመይ ትረኽብዎ',
		preheader: 'ቀጥታዊ ስልኪ፣ ናይ ስራሕ ሰዓታትን ቆጸራን ብሓንሳብ።',
		headline: 'ንኣገልግሎት ምኽርኹም ብኸመይ ትረኽብዎ',
		paragraphs: [
			'ብዘይካ እቲ ውሑስ ዕላል፣ ንኣገልግሎት ምኽርኹም ብስልኪ እውን ክትረኽብዎ ወይ ብቐጥታ ቆጸራ ክትሕዙ ትኽእሉ።',
			'መእተዊኹም ስም ኣልቦ ኮይኑ ይጸንሕ – እንታይ ከም እትነግሩ ንስኹም ትውስኑ።'
		],
		panel: [
			{ label: 'ኣገልግሎት ምኽሪ', value: '{{consultantName}}' },
			{ label: 'ቀጥታዊ ስልኪ', value: '{{consultantPhone}}' },
			{ label: 'ናይ ስራሕ ሰዓታት', value: '{{consultantHours}}' },
			{ label: 'ኢመይል', value: '{{consultantEmail}}' }
		],
		cta: { label: 'ቆጸራ ሓዙ', href: '{{bookingUrl}}' },
		secondaryAction: {
			label: 'ናብቲ ውሑስ ዕላል',
			href: '{{messageUrl}}'
		},
		footnote:
			'ካብ ናይ ስራሕ ሰዓታት ወጻኢ ኣብ ዕላል ምጽሓፍ ይሓይሽ። ኣብ ውሽጢ 2 ናይ ስራሕ መዓልትታት ንምለሰልኩም።',
		assurance,
		footer
	},

	'anfrage-zugewiesen': {
		subject: 'ሓድሽ ሕቶ ምኽሪ',
		preheader: 'ሓድሽ ሕቶ ይጽበየኩም ኣሎ።',
		headline: 'ሓድሽ ሕቶ ይጽበየኩም ኣሎ',
		paragraphs: [
			'ሓድሽ ሕቶ ምኽሪ ተመዲቡልኩም ኣሎ። ዝርዝሩ ድሕሪ ምእታውኩም ኣብ ክፍሊ ምኽሪ ትርእይዎ።'
		],
		panel: [
			{ label: 'ኣርእስቲ', value: '{{requestTopic}}' },
			{ label: 'ፖስጣ ኮድ', value: '{{requestPostcode}}' },
			{ label: 'ዝኣተወሉ', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'ሕቶ ክፈቱ', href: '{{requestUrl}}' },
		footnote: 'በጃኹም ነቲ ሕቶ ኣብ ውሽጢ 2 ናይ ስራሕ መዓልትታት ተቐበልዎ።',
		assurance,
		footer
	},

	'systemhinweis': {
		subject: 'ብመደብ ዝተታሕዘ ጽገና ኣብ {{maintenanceDate}}',
		preheader: 'ካብ {{maintenanceStart}} ክሳብ {{maintenanceEnd}} ኣይርከብን።',
		headline: 'ሓጺር ናይ ጽገና ዕረፍቲ',
		paragraphs: [
			'ኣብ {{maintenanceDate}}፣ {{platformName}} ካብ {{maintenanceStart}} ክሳብ {{maintenanceEnd}} ኣይርከብን።',
			'ድሕሪኡ ከም ልሙድ ክትጽሕፉ ትኽእሉ።'
		],
		cta: { label: 'ገጽ ኩነታት ተመልከቱ', href: '{{statusUrl}}' },
		footnote: 'ቅድሚ ሕጂ ዝጸሓፍኩምዎም መልእኽትታት ኣይጠፍኡን።',
		assurance,
		footer
	},

	'neue-anfrage': {
		subject: 'ኣብ ማእከል ምኽርኹም ሓድሽ ሕቶ',
		preheader: 'ሓደ ሕቶ ክቕበሎ ዝጽበ ኣሎ።',
		headline: 'ሓድሽ ሕቶ ኣትዩ ኣሎ',
		paragraphs: [
			'ኣብ ማእከል ምኽርኹም ሓድሽ ሕቶ ምኽሪ ኣትዩ ኣሎ። ገና ንዝኾነ ሰብ ኣይተመደበን።',
			'ዝተቐበሎ ሰብ ነቲ ምኽሪ ይርከቦ።'
		],
		panel: [
			{ label: 'ኣርእስቲ', value: '{{requestTopic}}' },
			{ label: 'ፖስጣ ኮድ', value: '{{requestPostcode}}' },
			{ label: 'ዝኣተወሉ', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'ሕቶ ተመልከቱ', href: '{{requestUrl}}' },
		footnote: 'በጃኹም ነቲ ሕቶ ኣብ ውሽጢ 2 ናይ ስራሕ መዓልትታት ተቐበልዎ።',
		assurance: staffAssurance,
		footer
	},

	'direkte-anfrage': {
		subject: 'ሓደ ሕቶ ብቐጥታ ናባኹም ዝቐንዐ እዩ',
		preheader: 'እዚ ሕቶ ንዓኹም ተጻሒፉ።',
		headline: 'ሓደ ሕቶ ብቐጥታ ናባኹም ዝቐንዐ እዩ',
		paragraphs: [
			'ሓደ ምኽሪ ዝሓትት ሰብ፣ ሕቶኡ ክጽሕፍ ከሎ ብንጹር ንዓኹም መሪጹ።',
			'ነቲ ሕቶ ክትርከብዎ እንተዘይክኢልኩም፣ ከይተርፍ በጃኹም ናብ ማእከል ምኽሪ መልስዎ።'
		],
		panel: [
			{ label: 'ኣርእስቲ', value: '{{requestTopic}}' },
			{ label: 'ዝኣተወሉ', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'ሕቶ ክፈቱ', href: '{{requestUrl}}' },
		footnote: 'በጃኹም ኣብ ውሽጢ 2 ናይ ስራሕ መዓልትታት መልሱ።',
		assurance: staffAssurance,
		footer
	},

	'tagesuebersicht': {
		subject: 'መዓልታዊ ጽማቕኩም',
		preheader: 'ኣብ ማእከል ምኽርኹም ዘለዉ ክፉታት ሕቶታት።',
		headline: 'መዓልታዊ ጽማቕኩም',
		paragraphs: ['ኣብ ማእከል ምኽርኹም ክቕበሉ ዝጽበዩ ክፉታት ሕቶታት ኣለዉ።'],
		panel: [
			{ label: 'ክፉታት ሕቶታት', value: '{{openRequestCount}}' },
			{ label: 'ዝነውሐ ጽበት', value: '{{oldestRequestAge}}' },
			{ label: 'ኩነታት ኣብ', value: '{{digestGeneratedAt}}' }
		],
		cta: { label: 'ሕቶታት ተመልከቱ', href: '{{requestUrl}}' },
		footnote: 'እዚ ጽማቕ ኣብ መዓልቲ ሓንሳብ ይመጽእ። ኣብ ቅንብራት ክትስርዝዎ ትኽእሉ።',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-angefragt': {
		subject: 'ምትሕልላፍ ተሓቲቱ',
		preheader: 'ሓደ ምኽሪ ናባኹም ክመሓላለፍ ተሓቲቱ ኣሎ።',
		headline: 'ሓደ ምኽሪ ናባኹም ክመሓላለፍ ተሓቲቱ ኣሎ',
		paragraphs: [
			'{{fromConsultantName}} ዝካየድ ዘሎ ምኽሪ ናባኹም ክመሓላለፍ ይሓትት ኣሎ።',
			'በጃኹም ኣብ ክፍሊ ምኽሪ ክትርከብዎ ትኽእሉ እንተኾንኩም ኣረጋግጹ።'
		],
		panel: [
			{ label: 'ጉዳይ', value: '{{caseReference}}' },
			{ label: 'ዝሓተተ', value: '{{fromConsultantName}}' },
			{ label: 'ዝተሓተተሉ', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'ምትሕልላፍ ኣረጋግጹ', href: '{{requestUrl}}' },
		footnote: 'ክሳብ እትሰማምዑ፣ እቲ ምኽሪ ኣብ ትሕቲ እቲ ናይ ቅድሚ ሕጂ ክኢላ ይጸንሕ።',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-bestaetigt': {
		subject: 'ምትሕልላፍ ተረጋጊጹ',
		preheader: 'እቲ ሓላፍነት ተቐዪሩ።',
		headline: 'እቲ ምትሕልላፍ ተረጋጊጹ',
		paragraphs: [
			'እቲ ምኽሪ ተረኪቡ። ካብ ሕጂ ንደሓር {{toConsultantName}} ሓላፍነት ይወስድ።',
			'እቲ ምኽሪ ዝሓተተ ሰብ ኣብ መተግበሪ ተሓቢሩ ኣሎ።'
		],
		panel: [
			{ label: 'ጉዳይ', value: '{{caseReference}}' },
			{ label: 'ሓድሽ ሓላፍነት', value: '{{toConsultantName}}' },
			{ label: 'ዝተመሓላለፈሉ', value: '{{handoverAt}}' }
		],
		cta: { label: 'ምኽሪ ክፈቱ', href: '{{requestUrl}}' },
		footnote: 'ናብቲ ናይ ቅድሚ ሕጂ ታሪኽ ዝነበረኩም መእተዊ ምስቲ ምትሕልላፍ ይውዳእ።',
		assurance: staffAssurance,
		footer
	},

	'rueckmeldung': {
		subject: 'ኣብ ሞያዊ ልውውጥ ሓድሽ ግብረ መልሲ',
		preheader: 'ኣብ ሞያዊ ልውውጥ ግብረ መልሲ ይጽበየኩም ኣሎ።',
		headline: 'ኣብ ሞያዊ ልውውጥ ሓድሽ ግብረ መልሲ',
		paragraphs: [
			'ብዛዕባ ሓደ ካብ ምኽርታትኩም ኣብ ዝካየድ ውሑስ ሞያዊ ልውውጥ ሓድሽ ግብረ መልሲ ኣሎ።',
			'ትሕዝቶኡ ድሕሪ ምእታውኩም ተመስጢሩ ትርእይዎ።'
		],
		panel: [
			{ label: 'ጉዳይ', value: '{{caseReference}}' },
			{ label: 'ዝኣተወሉ', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'ግብረ መልሲ ኣንብቡ', href: '{{messageUrl}}' },
		footnote: 'እቲ ሞያዊ ልውውጥ ነቲ ምኽሪ ዝሓተተ ሰብ ኣይረአን።',
		assurance: staffAssurance,
		footer
	},

	'mitteilung': {
		subject: '{{messageSubject}}',
		preheader: '{{messagePreview}}',
		headline: '{{messageHeadline}}',
		paragraphs: ['{{messageBody}}'],
		cta: { label: 'ናብ {{platformName}}', href: '{{loginUrl}}' },
		assurance,
		footer
	},

	'anmeldelink': {
		subject: 'ናይ {{platformName}} መእተዊ መላግቦኹም',
		preheader: 'እቲ መላግቦ ን{{expiryMinutes}} ደቓይቕ ይሰርሕ።',
		headline: 'መእተዊ መላግቦኹም',
		paragraphs: [
			'በዚ መላግቦ ብዘይ መሕለፊ ቃል ትኣትዉ።',
			'እቲ መላግቦ ን{{expiryMinutes}} ደቓይቕ ይሰርሕ፣ ሓንሳብ ጥራይ ድማ ይሰርሕ።'
		],
		cta: { label: 'ሕጂ እቶዉ', href: '{{loginUrl}}' },
		footnote:
			'ክትኣትዉ ዘይደለኹም እንተኾይኑ፣ ነዛ ኢመይል ግደፍዋ። ብዘይቲ መላግቦ ዝኾነ ነገር ኣይፍጸምን።',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einmalcode': {
		subject: 'ንመእተዊ ዝኸውን ናይ ሓደ ግዜ ኮድኩም',
		preheader: 'እቲ ኮድ ን{{expiryMinutes}} ደቓይቕ ይሰርሕ።',
		headline: 'ናይ ሓደ ግዜ ኮድኩም',
		paragraphs: ['ነዚ ኮድ ኣብቲ መእተዊ መስኮት ኣእትውዎ።'],
		code: { label: 'ኮድ', value: '{{otpCode}}' },
		cta: { label: 'ናብ መእተዊ', href: '{{loginUrl}}' },
		footnote: 'ክትኣትዉ ዘይደለኹም እንተኾይኑ፣ በጃኹም መሕለፊ ቃልኩም ቀይሩ።',
		assurance: codeAssurance,
		footer: securityFooter
	},

	'einladung-traeger': {
		subject: 'ዕድመ፦ {{tenantName}} ኣብ {{platformName}}',
		preheader: 'ናይ ምምሕዳር መእተዊኹም ኣዳልዉ።',
		headline: 'እንኳዕ ናብ {{platformName}} ብደሓን መጻእኩም',
		paragraphs: [
			'ን{{tenantName}} ናብ ምምሕዳር {{platformName}} መእተዊ ተዳልዩ ኣሎ።',
			'በቲ መላግቦ መሕለፊ ቃልኩም ተቐምጡ፣ ነቲ ምድላው ድማ ትውድእዎ።'
		],
		panel: [
			{ label: 'ትካል', value: '{{tenantName}}' },
			{ label: 'መላግቦ ዝሓልፈሉ', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'መእተዊ ኣዳልዉ', href: '{{inviteUrl}}' },
		footnote: 'ነዚ ዕድመ ዘይትጽበይዎ እንተነይርኩም፣ በጃኹም ነቲ ዝዓደመኩም ሰብ ርኸብዎ።',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einladung-fachkraft': {
		subject: 'ኣብ {{platformName}} ናብ ምኽሪ ዕድመ',
		preheader: 'ከም ክኢላ መእተዊኹም ኣዳልዉ።',
		headline: 'ናብ ምኽሪ ተዓዲምኩም ኣለኹም',
		paragraphs: [
			'{{agencyName}} ከም ክኢላ ናብ {{platformName}} ዓዲሙኩም ኣሎ።',
			'በቲ መላግቦ መሕለፊ ቃልኩም ተቐምጡ፣ ክልተ-ደረጃ መእተዊ ድማ ተዳልዉ።'
		],
		panel: [
			{ label: 'ማእከል ምኽሪ', value: '{{agencyName}}' },
			{ label: 'መላግቦ ዝሓልፈሉ', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'መእተዊ ኣዳልዉ', href: '{{inviteUrl}}' },
		footnote: 'ብዘይ ክልተ-ደረጃ መእተዊ ናብ ምኽርታት ምእታው ኣይከኣልን።',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'avv-unterschrift': {
		subject: 'ውዕል ኣተሓሕዛ ዳታ ንፊርማ',
		preheader: 'እቲ ውዕል ን{{tenantName}} ተዳልዩ ኣሎ።',
		headline: 'እቲ ውዕል ንፊርማ ተዳልዩ ኣሎ',
		paragraphs: [
			'ን{{tenantName}} ውዕል ኣተሓሕዛ ዳታ ተዳልዩ ኣሎ።',
			'በጃኹም ነቲ ውዕል ኣረጋግጹ፣ ብዲጂታል ድማ ፈርምዎ።'
		],
		panel: [
			{ label: 'ትካል', value: '{{tenantName}}' },
			{ label: 'ዝቐረበሉ', value: '{{dpaProvidedAt}}' },
			{ label: 'ክሳብ ዝፍረም', value: '{{dpaExpiresAt}}' }
		],
		cta: { label: 'ውዕል ክፈቱ', href: '{{dpaUrl}}' },
		footnote: 'ብዘይ ዝተፈረመ ውዕል ኣተሓሕዛ ዳታ፣ ነዚ ትካል ምኽሪ ተዓጽዩ ይጸንሕ።',
		assurance: legalAssurance,
		footer: legalFooter
	},

	'team-aenderung': {
		subject: 'ኣብ ጋንታኹም ለውጢ',
		preheader: 'ሓላፍነታትኩም ተቐዪሮም።',
		headline: 'ኣብ ጋንታኹም ገለ ተቐዪሩ',
		paragraphs: [
			'{{teamChangeStatement}}',
			'ንሓላፍነታትኩም እንታይ ማለት ምዃኑ ኣብ ክፍሊ ምኽሪ ትርእይዎ።'
		],
		panel: [
			{ label: 'ጉዳይ', value: '{{caseReference}}' },
			{ label: 'ዝተቐየረሉ', value: '{{teamChangedAt}}' }
		],
		cta: { label: 'ናብ ክፍሊ ምኽሪ', href: '{{appUrl}}' },
		footnote: 'እዚ መፍለጢ ይለኣኽ ዶ ኣይለኣኽን ትካልኩም ይውስን።',
		assurance: staffAssurance,
		footer
	},

	'smtp-test': {
		subject: 'ናይ SMTP ፈተነ ተዓዊቱ',
		preheader: 'ብ{{smtpHost}} ምልኣኽ ይሰርሕ ኣሎ።',
		headline: 'ናይ SMTP ፈተነ በጺሑ',
		paragraphs: [
			'ነዛ ኢመይል እንተነቢብኩም፣ በቲ ዝተመዝገበ ናይ SMTP ሓበሬታ ምልኣኽ ይሰርሕ ኣሎ ማለት እዩ።'
		],
		panel: [
			{ label: 'ሰርቨር', value: '{{smtpHost}}' },
			{ label: 'ላኣኺ', value: '{{smtpFrom}}' },
			{ label: 'ዝተላእከሉ', value: '{{sentAt}}' }
		],
		cta: { label: 'ናብ ምምሕዳር', href: '{{appUrl}}' },
		footnote: 'እዛ ኢመይል ካብ ምምሕዳር ምስ እትሕተት ጥራይ እያ እትለኣኽ።',
		assurance: staffAssurance,
		footer
	},

	'email-geaendert': {
		subject: 'ኢመይል ኣድራሻኹም ተቐዪሩ',
		preheader: 'እቲ ለውጢ ካብ ሕጂ ጀሚሩ ይሰርሕ።',
		headline: 'ኢመይል ኣድራሻኹም ተቐዪሩ',
		paragraphs: [
			'ናይ መእተዊ {{username}} ኢመይል ኣድራሻ ተቐዪሩ። ካብ ሕጂ ጀሚሮም መፍለጢታት ናብዚ ኣድራሻ ይኸዱ።',
			'ንስኹም ዘይኮንኩም እንተኾይኑ፣ በጃኹም ብኡንብኡ መሕለፊ ቃልኩም ቀይሩ።'
		],
		cta: { label: 'ናብ ፕሮፋይል', href: '{{appUrl}}' },
		assurance: accountAssurance,
		footer: securityFooter
	}
};
