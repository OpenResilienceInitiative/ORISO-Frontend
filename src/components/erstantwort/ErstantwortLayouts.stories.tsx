import * as React from 'react';
import { useCallback, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ErstantwortSequence } from './ErstantwortSequence';
import { ErstantwortFaqGroup } from './ErstantwortFaqGroup';
import { ErstantwortInfoLinks } from './ErstantwortInfoLinks';
import { EnquiryReceivedIllustration } from './EnquiryReceivedIllustration';
import { resolveErstantwortBausteine } from './erstantwortResolve';
import type { ResolvedBaustein } from './erstantwortResolve';
import { UNTOGGLEABLE_BAUSTEIN_IDS } from './erstantwortCatalogue';
import { ModalContext, type TOverlay } from '../../globalState';
import './ErstantwortSequence.styles.scss';
import './ErstantwortIllustrationFormats.styles.scss';

/**
 * # Erstantwort — drei Layouts nebeneinander
 *
 * **Vorschlag, nichts ist entschieden.** Begleitpapier:
 * `0 - Docs/VORSCHLAG-erstantwort-faq-layout-2026-09-07.md`.
 *
 * Das Problem: die Erstantwort ist inhaltlich richtig und optisch zu lang.
 * Nach der ersten Nachricht stapeln sich **zehn** graue Blasen; wer gerade
 * etwas Schweres geschrieben hat, liest die nicht, sondern scrollt daran
 * vorbei. Frank möchte entweder (a) kurze Nachricht plus Links, die Dialoge
 * öffnen, oder (b) ein Akkordeon, in dem die häufigen Fragen zugeklappt
 * stehen — er neigt zu (b) („chatmäßiger").
 *
 * ## Die harte Randbedingung
 *
 * ADR-018 §6 macht `noPersonalData` und `emergencyNumbers` zu **nicht
 * abschaltbaren** Sicherheits-Bausteinen (`UNTOGGLEABLE_BAUSTEIN_IDS`), und
 * die Katalog-Reihenfolge stellt die Sicherheits-Bausteine bewusst **vor**
 * jede optionale Aktion. Beide Varianten hier lassen diese zwei Bausteine
 * daher als normale, offene Blasen stehen — sie wandern in v1 und v2 sogar
 * **nach oben**, direkt hinter die Begrüßung.
 *
 * ADR-018 friert den **Wortlaut** eines persistierten Events ein („frozen
 * words, live state", §4), nicht sein **Layout**: das Event speichert
 * `{id, headline, body, action, links}`, und wie das Frontend diese Bausteine
 * anordnet, steht in keinem Beschluss. Eine Layout-Änderung ist deshalb
 * erlaubt; kein Text unten ist umgeschrieben, nur anders angeordnet.
 * Neu ist ausschließlich die **Frageform der Überschrift** über einer
 * zugeklappten Zeile (`erstantwortFaqQuestions.ts`).
 *
 * ## Was hier vergleichbar ist
 *
 * Alle drei Stories rendern **dieselben aufgelösten Bausteine** — einmal
 * aufgelöst, dann nur unterschiedlich gruppiert. Alle drei laufen mit
 * `skipAnimation`, damit die volle Länge sichtbar ist; ausgeliefert wird
 * heute mit `staggerMs: 1400`.
 */
const meta = {
	title: 'Templates/Erstantwort-Layouts',
	component: ErstantwortSequence,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	args: { onAction: () => undefined, skipAnimation: true }
} satisfies Meta<typeof ErstantwortSequence>;

export default meta;
type Story = StoryObj<typeof meta>;

const translate = (_key: string, defaultValue?: string) => defaultValue ?? '';

/** Nothing done yet: no e-mail, 2FA offered but not switched on. */
const OPEN_STATE = {
	hasEmail: false,
	isTwoFactorEnabled: true,
	isTwoFactorActive: false
};

/**
 * Resolved **once**. Every variant below picks from this one array, so no
 * comparison can be won by quietly dropping a Baustein.
 */
const SHIPPED_SEQUENCE: ResolvedBaustein[] = resolveErstantwortBausteine({
	trigger: 'AFTER_FIRST_MESSAGE',
	context: { conversationType: 'AGENCY_COUNSELLING' },
	translate,
	state: OPEN_STATE
}).bausteine;

const byId = (id: string): ResolvedBaustein | undefined =>
	SHIPPED_SEQUENCE.find((baustein) => baustein.id === id);

const pick = (...ids: string[]): ResolvedBaustein[] =>
	ids
		.map(byId)
		.filter((baustein): baustein is ResolvedBaustein => Boolean(baustein));

/**
 * The informational Bausteine — everything that is neither the greeting, nor a
 * safety Baustein, nor an action, nor the closing.
 *
 * `freeNotice` is in the list and absent from the render: its default body is
 * empty and `erstantwortResolve` drops empty Bausteine, which is the designed
 * behaviour of the Freier Hinweis until a Träger fills it.
 */
const INFORMATIONAL_IDS = [
	'whoReadsAlong',
	'responseDeadline',
	'modalityNote',
	'dataProtection',
	'freeNotice'
];

/** ADR-018 §6 — these two never move behind a closed row. Asserted, not assumed. */
const SAFETY_IDS = [...UNTOGGLEABLE_BAUSTEIN_IDS];

const GREETING_WITH_ILLUSTRATION = {
	greeting: <EnquiryReceivedIllustration />
};

/* --------------------------------------------------------------------------
   v0 — Heute
   -------------------------------------------------------------------------- */

/**
 * **(v0) Heute — die Referenz.** Die ausgelieferte Sequenz nach der ersten
 * Nachricht in der Agentur-Beratung, ohne jede Änderung: **10 Blasen**
 * (`greeting`, `whoReadsAlong`, `responseDeadline`, `modalityNote`,
 * `noPersonalData`, `emergencyNumbers`, `dataProtection`, `emailNotification`,
 * `accountProtection`, `closing`; `freeNotice` ist leer und fällt weg).
 *
 * Die Sicherheits-Bausteine stehen hier an Position **5 und 6** — hinter drei
 * informativen Blasen. Genau das kehren v1 und v2 um.
 */
export const V0Heute: Story = {
	args: { bausteine: SHIPPED_SEQUENCE }
};

/* --------------------------------------------------------------------------
   v1 — FAQ-Akkordeon
   -------------------------------------------------------------------------- */

/**
 * The one bubble that holds the FAQ rows. Not a catalogue Baustein — a
 * container the layout introduces, which is exactly what would have to be
 * added to `erstantwortCatalogue.ts` if this variant is chosen.
 */
const FAQ_BUBBLE: ResolvedBaustein = {
	id: 'faq',
	headline: 'Häufige Fragen',
	body: 'Öffnen Sie, was Sie interessiert.'
};

const v1Bausteine = (): ResolvedBaustein[] => [
	...pick('greeting'),
	...pick(...SAFETY_IDS),
	FAQ_BUBBLE,
	...pick('emailNotification', 'accountProtection', 'closing')
];

const v1Slots = (openFirst: boolean) => ({
	...GREETING_WITH_ILLUSTRATION,
	faq: (
		<ErstantwortFaqGroup
			bausteine={pick(...INFORMATIONAL_IDS)}
			openFirst={openFirst}
			translate={translate}
		/>
	)
});

/**
 * **(v1) FAQ-Akkordeon, alles zu — 7 Blasen statt 10.**
 *
 * Begrüßung (mit Bild) → „Bitte keine persönlichen Daten senden" → „Wenn es
 * nicht warten kann" → **eine** Blase „Häufige Fragen" mit vier zugeklappten
 * Zeilen → die beiden Aktionskarten → Abschluss.
 *
 * Die vier Zeilen tragen **neue Überschriften in Frageform** („Wer liest meine
 * Nachricht?" statt „Wer Ihre Nachricht liest"). Über einem offenen Absatz ist
 * die Aussageform richtig, auf einer geschlossenen Zeile ist sie es nicht:
 * niemand tippt auf eine Behauptung. Die **Fließtexte sind unverändert** —
 * ADR-018 §4 friert den Wortlaut ein, das Layout nicht.
 *
 * Was zu prüfen ist: Erkennt man ohne Anleitung, dass die Zeilen aufgehen?
 */
export const V1FaqAkkordeon: Story = {
	args: { bausteine: v1Bausteine(), slots: v1Slots(false) }
};

/**
 * **(v1) FAQ-Akkordeon, erste Zeile offen.** Dieselbe Anordnung, aber
 * „Wer liest meine Nachricht?" steht schon aufgeklappt da.
 *
 * Der Preis ist Höhe, der Gewinn ist, dass die Zeilen sichtbar aufklappbar
 * sind. Diese beiden Stories sind der eigentliche Vergleich, den Frank
 * entscheiden muss.
 */
export const V1FaqAkkordeonErsteZeileOffen: Story = {
	args: { bausteine: v1Bausteine(), slots: v1Slots(true) }
};

/* --------------------------------------------------------------------------
   v2 — Kurz + Dialoge
   -------------------------------------------------------------------------- */

/**
 * Storybook has neither the app's `ModalProvider` nor the `#overlay` node the
 * real `Overlay` portals into. Supplying both here keeps the story honest: the
 * dialog that opens is the **shipped** overlay, not a story-local imitation.
 */
const OverlayHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [overlays, setOverlays] = useState<TOverlay[]>([]);
	const addOverlay = useCallback(
		(overlay: TOverlay) => setOverlays((current) => [...current, overlay]),
		[]
	);
	const removeOverlay = useCallback(
		(id: string) =>
			setOverlays((current) =>
				current.filter((overlay) => overlay.id !== id)
			),
		[]
	);

	return (
		<ModalContext.Provider
			value={{ overlays, setOverlays, addOverlay, removeOverlay }}
		>
			{children}
			<div id="overlay" />
		</ModalContext.Provider>
	);
};

/**
 * The bubble that carries the links. Its body is `modalityNote` **verbatim** —
 * the one informational Baustein that is a single sentence and belongs in the
 * flow rather than behind a link.
 */
const linksBubble = (): ResolvedBaustein => ({
	id: 'infoLinks',
	body: byId('modalityNote')?.body ?? ''
});

/**
 * **(v2) Kurz + Dialoge — ebenfalls 7 Blasen, aber drei Texte hinter einem
 * Klick.**
 *
 * Begrüßung (mit Bild) → die beiden Sicherheits-Bausteine → eine Blase mit dem
 * Satz zur Modalität und drei Links, die **denselben** Text im vorhandenen
 * `Overlay` öffnen (kein neues Modal — es ist die Komponente, aus der auch
 * `ErstantwortEmailOverlay` besteht) → die Aktionskarten → Abschluss.
 *
 * Der Unterschied zu v1 ist nicht die Blasenzahl, sondern der Preis pro
 * Antwort: eine Akkordeonzeile kostet einen Tipp und bleibt im Gespräch, ein
 * Dialog kostet einen Tipp, verdeckt das Gespräch und kostet einen zweiten
 * Tipp zum Schließen.
 */
export const V2KurzUndDialoge: Story = {
	decorators: [
		(Story) => (
			<OverlayHost>
				<Story />
			</OverlayHost>
		)
	],
	args: {
		bausteine: [
			...pick('greeting'),
			...pick(...SAFETY_IDS),
			linksBubble(),
			...pick('emailNotification', 'accountProtection', 'closing')
		],
		slots: {
			...GREETING_WITH_ILLUSTRATION,
			infoLinks: (
				<ErstantwortInfoLinks
					bausteine={pick(
						'whoReadsAlong',
						'responseDeadline',
						'dataProtection'
					)}
					translate={translate}
				/>
			)
		}
	}
};

/* --------------------------------------------------------------------------
   v3 — Illustration: Formatvergleich
   -------------------------------------------------------------------------- */

/**
 * Neutral stand-ins, deliberately **not** artwork: three empty panels in the
 * M3 greys, so the story shows what a format does to the layout and nothing
 * about what the picture will look like.
 *
 * Loaded through `<img src="data:…">` rather than inlined, because that is
 * exactly how the final PNG will arrive — same replaced-element sizing, same
 * `loading="lazy"`, same `width`/`height` attributes. An inline `<svg>` sizes
 * differently (it letterboxes inside its box instead of scaling), so a stand-in
 * built that way would have measured the wrong thing.
 */
const portraitStandIn = (): string => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400" viewBox="0 0 320 400">
<rect width="320" height="400" rx="12" fill="#f0edee"/>
<rect x="16" y="16" width="288" height="112" rx="8" fill="#e0e3e3" stroke="#c4c7c8"/>
<rect x="16" y="144" width="288" height="112" rx="8" fill="#e0e3e3" stroke="#c4c7c8"/>
<rect x="16" y="272" width="288" height="112" rx="8" fill="#e0e3e3" stroke="#c4c7c8"/>
<text x="160" y="80" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#747878">1</text>
<text x="160" y="208" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#747878">2</text>
<text x="160" y="336" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#747878">3</text>
</svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const PortraitStandIn: React.FC<{ variant: 'today' | 'proposed' }> = ({
	variant
}) => (
	<div
		className={`enquiryReceivedIllustration enquiryReceivedIllustration--${variant}`}
		aria-hidden="true"
	>
		<img
			src={portraitStandIn()}
			width={320}
			height={400}
			loading="lazy"
			alt=""
		/>
	</div>
);

const FormatRow: React.FC<{
	caption: string;
	illustration: React.ReactNode;
}> = ({ caption, illustration }) => (
	<section className="erstantwortFormatRow">
		<h3 className="erstantwortFormatRow__caption">{caption}</h3>
		<ErstantwortSequence
			bausteine={pick('greeting')}
			skipAnimation
			slots={{ greeting: illustration }}
		/>
	</section>
);

/**
 * **(v3) Illustration — Formatvergleich.** Dieselbe Begrüßungsblase dreimal.
 *
 * 1. **Heute:** `enquiry-received.svg`, 320 × 200 (16:10), gedeckelt auf
 *    `max-width: 320px`.
 * 2. **Hochformat 4:5 im heutigen Deckel:** dasselbe CSS, anderes Seiten­
 *    verhältnis — die Blase wird zum Plakat.
 * 3. **Vorschlag:** Deckel über die **Höhe** (`max-height: 260px`,
 *    `width: auto`), Bild vollständig, kein Beschnitt.
 *
 * Warum **nicht** `object-fit: cover` mit Fokus-Crop, obwohl das die naheliegende
 * Antwort auf ein zu hohes Bild ist: die finale Zeichnung ist ein **Drei-Panel**-
 * Bild. Ein Höhen-Crop schneidet Panel 1 oder 3 an, also den Anfang oder das
 * Ende der Geschichte. Ein Bild, das man beschneiden darf, hat einen Fokuspunkt;
 * dieses hat drei.
 *
 * Technisch für ein PNG (heute SVGR-Inline):
 * `EnquiryReceivedIllustration.tsx` Zeile 2 (`import { ReactComponent as
 * EnquiryReceived } …`) und Zeile 19 (`<EnquiryReceived />`) müssen auf
 * `<img src={…} width height loading="lazy" alt="" />` umgestellt werden,
 * `EnquiryReceivedIllustration.styles.scss` Zeile 8 (`svg { … }`) auf `img`.
 */
export const V3IllustrationFormatvergleich: Story = {
	args: { bausteine: pick('greeting') },
	render: () => (
		<div className="erstantwortFormatCompare">
			<FormatRow
				caption="1 · Heute — 16:10 SVG, max-width 320px"
				illustration={<EnquiryReceivedIllustration />}
			/>
			<FormatRow
				caption="2 · Hochformat 4:5 im heutigen Deckel (max-width 320px)"
				illustration={<PortraitStandIn variant="today" />}
			/>
			<FormatRow
				caption="3 · Vorschlag — Hochformat, max-height 260px, kein Beschnitt"
				illustration={<PortraitStandIn variant="proposed" />}
			/>
		</div>
	)
};
