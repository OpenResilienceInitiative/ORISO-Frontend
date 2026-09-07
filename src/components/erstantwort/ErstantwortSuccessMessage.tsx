import * as React from 'react';
import { useState } from 'react';

import { ErstantwortSequence } from './ErstantwortSequence';
import { ErstantwortFaqGroup } from './ErstantwortFaqGroup';
import { ErstantwortImageSlot } from './ErstantwortImageSlot';
import { UNTOGGLEABLE_BAUSTEIN_IDS } from './erstantwortCatalogue';
import { ERSTANTWORT_MODUL1_FAQ_ROW_IDS } from './erstantwortFaqQuestions';
import { resolveErstantwortBausteine } from './erstantwortResolve';
import type { ResolvedBaustein } from './erstantwortResolve';
import {
	ERSTANTWORT_DISMISS,
	ERSTANTWORT_IMAGE_BRIEF,
	ERSTANTWORT_SHORTENED,
	ERSTANTWORT_SUBTITLES,
	flowText
} from './erstantwortFlowCopy';
import './ErstantwortSequence.styles.scss';
import './ErstantwortSuccessMessage.styles.scss';

/**
 * **Modul 1 — die Erfolgsnachricht, und sie enthält alles.**
 *
 * Franks Ansage vom 07.09.2026, abends: *"Modul 1 ist die Erfolgsnachricht und
 * enthält alles."* Kurzer Gruß, dazu ein **quadratischer** Bildplatz, und
 * **direkt dabei** die häufigen Fragen — nicht als zweite Nachricht, nicht
 * hinter einem Knopf.
 *
 * <h3>Warum diese Zusammenstellung eine Komponente ist und keine Story-Zeilen</h3>
 *
 * Sie steht an **zwei** Stellen: als Modul 1 in `Templates/Erstantwort-Module`
 * und als Nachricht 1 in `Templates/Erstantwort-Ablauf`. Zweimal
 * zusammengesetzt hieße, dass die beiden Stories bei der nächsten Änderung
 * auseinanderlaufen und niemand merkt, welche der beiden Frank gerade ansieht.
 *
 * <h3>Die rote Zeile</h3>
 *
 * `emergencyNumbers` ist wieder **im** Akkordeon, als letzte Zeile, zugeklappt
 * — aber in der Primärrolle gezeichnet. Frank hat die Empfehlung, sie offen zu
 * lassen, ausdrücklich verworfen: *"Ich würde sie einfach rot lassen. Und dann
 * kann der Nutzer sie ja auch selbst ausklappen."*
 *
 * ADR-018 §6 hält weiterhin: die Zeile steht im DOM, auf dem Bildschirm und im
 * Accessibility-Baum, ist von keinem Träger abschaltbar, und sie steht vor
 * jeder optionalen Aktion — die Benachrichtigungs-Auswahl ist erst die nächste
 * Nachricht.
 *
 * STORYBOOK ONLY. Kein App-Pfad importiert diese Datei.
 */

const translateFallback = (_key: string, defaultValue?: string) =>
	defaultValue ?? '';

/** Nichts erledigt: keine E-Mail, 2FA angeboten aber nicht eingeschaltet. */
const OPEN_STATE = {
	hasEmail: false,
	isTwoFactorEnabled: true,
	isTwoFactorActive: false
};

/**
 * Einmal aus dem **ausgelieferten** Katalog aufgelöst. Kein Text unten ist
 * nachgetippt; was hier steht, steht so im Produkt — mit Ausnahme der
 * ausdrücklich gekürzten Begrüßung (`ERSTANTWORT_SHORTENED`).
 */
const SHIPPED_SEQUENCE: ResolvedBaustein[] = resolveErstantwortBausteine({
	trigger: 'AFTER_FIRST_MESSAGE',
	context: { conversationType: 'AGENCY_COUNSELLING' },
	translate: translateFallback,
	state: OPEN_STATE
}).bausteine;

const byId = (id: string): ResolvedBaustein | undefined =>
	SHIPPED_SEQUENCE.find((baustein) => baustein.id === id);

const pick = (...ids: readonly string[]): ResolvedBaustein[] =>
	ids
		.map(byId)
		.filter((baustein): baustein is ResolvedBaustein => Boolean(baustein));

/**
 * Franks Reihenfolge (07.09., vormittags) — und `emergencyNumbers` steht darin
 * seit dem Abend wieder als **letzte** Zeile, statt als offene Blase daneben.
 */
export const ERSTANTWORT_SUCCESS_ROW_IDS = ERSTANTWORT_MODUL1_FAQ_ROW_IDS;

/** Die Zeile, die in der Primärrolle gezeichnet wird. Genau eine. */
export const ERSTANTWORT_PRIMARY_ROW_IDS = ['emergencyNumbers'] as const;

/*
 * ADR-018 §6, mechanisch geprüft statt zugesagt: beide Sicherheits-Bausteine
 * müssen vorkommen. Wer einen später still aus der Reihenfolge nimmt, bekommt
 * hier einen Fehler, statt eine Nachricht auszuliefern, der ein
 * Sicherheitstext fehlt.
 */
const missingSafetyRow = UNTOGGLEABLE_BAUSTEIN_IDS.find(
	(id) => !ERSTANTWORT_SUCCESS_ROW_IDS.includes(id)
);
if (missingSafetyRow) {
	throw new Error(
		`Modul 1: safety Baustein "${missingSafetyRow}" is missing from the FAQ ` +
			'row order (ADR-018 §6 — it may be folded, never dropped).'
	);
}

/*
 * Und die zweite Zusicherung, die diese Datei selbst halten kann: die rote
 * Zeile muss eine der gerenderten Zeilen sein. Eine Primärfarbe auf einer
 * Zeile, die es nicht gibt, fällt sonst niemandem auf.
 */
const strayPrimaryRow = ERSTANTWORT_PRIMARY_ROW_IDS.find(
	(id) => !ERSTANTWORT_SUCCESS_ROW_IDS.includes(id)
);
if (strayPrimaryRow) {
	throw new Error(
		`Modul 1: primary-toned row "${strayPrimaryRow}" is not part of the FAQ ` +
			'row order.'
	);
}

export interface ErstantwortSuccessMessageProps {
	/**
	 * Den quadratischen Bildplatz reservieren. Beide Fassungen sind gebaut,
	 * weil Frank die Höhe mit und ohne Bild vergleichen wollte.
	 */
	showImage?: boolean;
	/** Erste Akkordeonzeile schon aufgeklappt zeigen. */
	openFirstRow?: boolean;
	/** Die rote Zeile aufgeklappt zeigen — für den Screenshot. */
	openPrimaryRow?: boolean;
	/**
	 * Das Kästchen „Diese Hinweise nicht wieder anzeigen" unter die Fragen
	 * setzen. Was dieser Zustand kostet, steht im Verdrahtungspapier §14 — er
	 * ist die einzige Neuerung des Abends, die **nicht** reine Darstellung ist.
	 */
	dismissible?: boolean;
	/** Startzustand des Kästchens, damit eine Story den Ausgang zeigen kann. */
	initialDismissed?: boolean;
	translate?: (key: string, defaultValue: string) => string;
}

export const ErstantwortSuccessMessage: React.FC<
	ErstantwortSuccessMessageProps
> = ({
	showImage = true,
	openFirstRow = false,
	openPrimaryRow = false,
	dismissible = false,
	initialDismissed = false,
	translate = translateFallback
}) => {
	const [dismissed, setDismissed] = useState(initialDismissed);

	const greeting = byId('greeting');
	const greetingBubble: ResolvedBaustein[] = greeting
		? [{ ...greeting, body: flowText(ERSTANTWORT_SHORTENED.greeting) }]
		: [];

	/**
	 * Die FAQ-Blase. **Kein Katalog-Baustein**, sondern ein Container, den das
	 * Layout einführt. `body: ''` ist Absicht — die Überschrift trägt die
	 * Blase, und die leere Zeile wird in `ErstantwortFaqGroup.styles.scss`
	 * ausgeblendet, damit sie keine Zeilenhöhe kostet.
	 */
	const faqBubble: ResolvedBaustein = {
		id: 'faq',
		headline: 'Häufige Fragen',
		body: ''
	};

	/*
	 * Die Blase bleibt auch im ausgeblendeten Zustand stehen — mit einer
	 * anderen Überschrift und einer Zeile, die sie zurückholt. Ein Block, der
	 * nach dem Anhaken **spurlos** verschwindet, ist genau der Zustand, aus dem
	 * niemand mehr herausfindet: die Person hat dann kein Wort mehr auf dem
	 * Bildschirm, nach dem sie suchen könnte.
	 */
	const faqBubbleDismissed: ResolvedBaustein = {
		id: 'faq',
		headline: 'Häufige Fragen',
		body: flowText(ERSTANTWORT_DISMISS.dismissed, translate)
	};

	const bausteine = [
		...greetingBubble,
		dismissed ? faqBubbleDismissed : faqBubble
	];

	return (
		<ErstantwortSequence
			subtitle={flowText(ERSTANTWORT_SUBTITLES.enquirySent, translate)}
			bausteine={bausteine}
			skipAnimation
			slots={{
				/*
				 * Der Bildplatz hängt an der Begrüßungsblase, nicht an einer
				 * eigenen: „kurzer Gruß, dazu ein quadratischer Bildplatz" ist
				 * **eine** Aussage, und zwei Blasen daraus zu machen hieße,
				 * Carimat zweimal hintereinander dasselbe sagen zu lassen.
				 */
				greeting: showImage ? (
					<ErstantwortImageSlot brief={ERSTANTWORT_IMAGE_BRIEF} />
				) : undefined,
				faq: dismissed ? (
					<button
						type="button"
						className="erstantwortDismiss__restore"
						data-testid="erstantwort-faq-restore"
						onClick={() => setDismissed(false)}
					>
						{flowText(ERSTANTWORT_DISMISS.restore, translate)}
					</button>
				) : (
					<>
						<ErstantwortFaqGroup
							bausteine={pick(...ERSTANTWORT_SUCCESS_ROW_IDS)}
							openFirst={openFirstRow}
							openRowIds={
								openPrimaryRow
									? ERSTANTWORT_PRIMARY_ROW_IDS
									: undefined
							}
							primaryRowIds={ERSTANTWORT_PRIMARY_ROW_IDS}
							translate={translate}
						/>
						{dismissible && (
							<label
								className="erstantwortDismiss"
								data-testid="erstantwort-faq-dismiss"
							>
								<input
									type="checkbox"
									className="erstantwortDismiss__box"
									checked={dismissed}
									onChange={(event) =>
										setDismissed(event.target.checked)
									}
								/>
								<span>
									{flowText(
										ERSTANTWORT_DISMISS.label,
										translate
									)}
								</span>
							</label>
						)}
					</>
				)
			}}
		/>
	);
};
