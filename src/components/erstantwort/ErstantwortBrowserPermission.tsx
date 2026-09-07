import * as React from 'react';
import {
	ERSTANTWORT_BROWSER_BRANCH,
	flowText
} from './erstantwortFlowCopy';
import type { ErstantwortNotifyBrowserState } from './ErstantwortNotifyChoice';
import './ErstantwortBrowserPermission.styles.scss';

/**
 * **Zweig „Benachrichtigungen des Browsers" — die Nachricht nach der Auswahl.**
 * Vorschlag 07.09.2026, Storybook-only; kein App-Pfad importiert diese Datei.
 *
 * Sie ist das Gegenstück zu `ErstantwortNotifyChoice`: dort wird der Kanal
 * *gewählt*, hier wird er *eingerichtet*. Deshalb ein eigenes Molekül und kein
 * zweiter Zustand im Auswahl-Molekül — die Auswahl ist danach vorbei, und eine
 * Karte, die ihre eigene Auswahl weiter anzeigt, lädt zum Zurückwählen ein.
 *
 * <h3>Warum ein Knopf im Slot und keine Baustein-Aktion</h3>
 *
 * `ERSTANTWORT_ACTION_KINDS` (`erstantwortPayload.ts`) kennt fünf Werte, und
 * keiner davon ist „Browser-Erlaubnis". Ein sechster wäre eine
 * Wire-Format-Änderung an einem Datensatz, der als KDG-§11-Transparenznachweis
 * dient — für einen Vorgang, der **rein im Browser** stattfindet und den Server
 * nie erreicht. Der Knopf hängt deshalb im `slots`-Mechanismus, genau wie die
 * Karten in Modul 2 und 3.
 *
 * <h3>Was die drei Zustände dürfen</h3>
 *
 * - `available` — der Knopf. `Notification.permission === 'default'`, wir dürfen
 *   fragen, und wir fragen **nur** nach diesem ausdrücklichen Tippen.
 * - `granted` — eine Bestätigung, kein zweiter Knopf.
 * - `blocked` — **niemals ein Knopf.** `requestPermission()` löst auf einer
 *   blockierten Herkunft sofort mit `denied` auf und zeigt gar keinen Dialog;
 *   der ausgelieferte `requestPermissions()` ruft ihn dann nicht einmal auf.
 *   Ein Knopf hier wäre das eine, was diese Sequenz nie tun darf: aktiviert
 *   aussehen und nichts tun.
 * - `unsupported` — nichts. Diese Nachricht dürfte in dem Fall gar nicht
 *   entstehen, weil die Option in der Auswahl davor nicht angeboten wurde.
 */

export interface ErstantwortBrowserPermissionProps {
	state: ErstantwortNotifyBrowserState;
	/** Kein Handler, kein Knopf — dieselbe Regel wie in `ErstantwortSequence`. */
	onAllow?: () => void;
	translate?: (key: string, defaultValue: string) => string;
}

export const ErstantwortBrowserPermission: React.FC<
	ErstantwortBrowserPermissionProps
> = ({ state, onAllow, translate }) => {
	if (state === 'unsupported') return null;

	return (
		<div
			className="erstantwortPermission"
			data-testid="erstantwort-browser-permission"
			data-state={state}
		>
			{state === 'available' && onAllow && (
				/* Kein Symbol im Knopf: die Beschriftung bricht auf 390 px auf
				   zwei Zeilen um, und eine Glocke links davon steht dann neben
				   einem zweizeiligen, mittig gesetzten Text statt vor ihm. Die
				   Glocke hat ihren Platz eine Nachricht früher, im
				   Auswahlfeld — dort führt sie eine Zeile an. */
				<button
					type="button"
					className="erstantwortPermission__button"
					onClick={onAllow}
				>
					{flowText(ERSTANTWORT_BROWSER_BRANCH.action, translate)}
				</button>
			)}

			{state === 'granted' && (
				<p className="erstantwortPermission__status erstantwortPermission__status--done">
					{flowText(ERSTANTWORT_BROWSER_BRANCH.done, translate)}
				</p>
			)}

			{state === 'blocked' && (
				<p className="erstantwortPermission__status erstantwortPermission__status--blocked">
					{flowText(
						ERSTANTWORT_BROWSER_BRANCH.blocked,
						translate
					)}
				</p>
			)}
		</div>
	);
};
