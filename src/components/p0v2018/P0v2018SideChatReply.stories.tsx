/**
 * Storybook page "P0 v2.0.18", section *7 (FE#2494): reply to marked
 * passages in Supervision and in the enquiry's team side chat (incl. *8,
 * "stacked reply"). Design for Frank's approval before the app wiring.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { P7_PASSAGES, SideChatReplyStage } from './SideChatReplyStage';
import { stageRoute } from '../chatStage/__storybook__/chatStageFixtures';

const ALL_THREE = [
	P7_PASSAGES.letters,
	P7_PASSAGES.contract,
	P7_PASSAGES.sleep
];

const meta = {
	title: 'P0 v2.0.18/*7 Antworten in Supervision und Team-Chat',
	component: SideChatReplyStage,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		docs: {
			description: {
				component: [
					'FE#2494 *7 (mit *8 „Stacked Reply“). Text im Chat mit der Ratsuchenden markieren → die bekannte Leiste, vereinfacht: **Antworten · In Supervision antworten · Im Team-Chat antworten · Thread** (Schwärzen nur für Moderierende). Die Sprachnachricht ist keine eigene Aktion mehr — das Mikrofon sitzt im Antwort-Feld. Stapeln ist ein ruhiges Symbol (Zeilen in eine Ablage) mit der Nummer der nächsten gestapelten Antwort; Senden bleibt rot. Das Feld ist rund und wächst mehrzeilig.',
					'**Variante (Frank, 23.11.):** statt der Leiste ein kleiner Antwort-Griff oben rechts an der markierten Stelle; er öffnet ein Sprechblasen-Menü mit Feld, Mikrofon, Sammeln, Senden und darunter Supervision · Team-Chat · Thread.',
					'Markieren, Antworten und Sammeln gibt es **auch in der Supervision, im Team-Chat und im Thread** — dort sammelt sich das Zitat in deren eigener Eingabe; jedes Zitat zeigt, wer es geschrieben hat.',
					'„In Supervision antworten“ oder „Im Team-Chat antworten“ öffnet das Antwort-Feld **für diesen Seitenchat** (oben steht, wohin es geht): stapeln legt Zitat + Antwort in dessen Eingabe und öffnet ihn, Senden schickt sofort dorthin. Gesendet wird nur im Seitenchat — die Eingabe der Ratsuchenden hat keinen Ziel-Umschalter, also geht nichts versehentlich an sie.',
					'Gesendet wird **eine** Nachricht mit allen Zitaten; ein Klick auf ein Zitat springt zur Stelle im Chat. Im Team-Chat gibt es jetzt Audio- und Videoanruf wie in der Supervision (gleiche Komponente `PanelCallActions`).',
					'Gebaut aus: `SelectionReplyLayer`/`SelectionReplyToolbar`, `SelectionReplyPopover`, `MessageTimeline` (`PassageReplyBlocks`), `MessageSubmitInterfaceComponent` (`ComposerPendingQuotes`), `SidePanel`, `PanelHeader`, `PanelCallActions`. Symbole aus `src/resources/img/icons`.'
				].join('\n\n')
			}
		}
	}
} satisfies Meta<typeof SideChatReplyStage>;

export default meta;
type Story = StoryObj<typeof meta>;

const waitForSelector = (root: HTMLElement, selector: string) =>
	waitFor(
		() => {
			const found = root.querySelector<HTMLElement>(selector);
			if (!found) {
				throw new Error(`${selector} not shown`);
			}
			return found;
		},
		{ timeout: 4000 }
	);

/** Zum Durchklicken: markieren → Seitenchat wählen → sammeln → senden. */
export const Experience: Story = {
	name: 'Erlebnis — markieren, in Supervision sammeln, senden'
};

/** 1 · Die Leiste über der markierten Stelle, mit den zwei neuen Zielen. */
export const Toolbar: Story = {
	name: '1 · Leiste: Antworten · Supervision · Team-Chat · Thread',
	args: { preset: P7_PASSAGES.sleep },
	play: async ({ canvasElement }) => {
		const bar = await waitForSelector(
			canvasElement,
			'[data-cy="selection-reply-toolbar"]'
		);
		const names = within(bar)
			.getAllByRole('button')
			.map((button) => button.getAttribute('aria-label'));
		await expect(names).toEqual([
			'Hier antworten',
			'In Supervision antworten',
			'Im Team-Chat antworten',
			'Thread'
		]);
	}
};

/** 2 · „Antworten“ im selben Chat: Mikrofon im Feld, Stapeln als ruhiges Symbol wie das Mikrofon, Senden rot. */
export const ReplyField: Story = {
	name: '2 · Antwort-Feld: Feld rund und mehrzeilig, Mikrofon, Stapel-Symbol',
	args: { preset: P7_PASSAGES.sleep, presetMode: 'popover' }
};

/** 3 · „In Supervision antworten“: das Antwort-Feld für die Supervision — stapeln oder senden. */
export const IntoSupervision: Story = {
	name: '3 · „In Supervision antworten“ → Feld mit Stapeln, dann in der Supervision',
	args: { preset: P7_PASSAGES.letters },
	play: async ({ canvasElement }) => {
		const bar = await waitForSelector(
			canvasElement,
			'[data-cy="selection-reply-toolbar"]'
		);
		await userEvent.click(
			within(bar).getByRole('button', {
				name: 'In Supervision antworten'
			})
		);
		const target = await waitForSelector(
			canvasElement,
			'[data-cy="selection-reply-target"]'
		);
		await expect(target).toHaveAccessibleName('In Supervision antworten');
		await expect(target).toHaveTextContent('Supervision');
		await userEvent.type(
			canvasElement.querySelector<HTMLTextAreaElement>(
				'.selectionReply__input'
			)!,
			'Wie spreche ich die Briefe an?'
		);
		await userEvent.click(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="selection-reply-collect"]'
			)!
		);
		const panel = await waitForSelector(
			canvasElement,
			'[data-side-room="supervision"]'
		);
		await waitFor(() =>
			expect(
				panel.querySelectorAll(
					'[data-cy="composer-pending-quotes"] .messageSubmit__contextBar'
				)
			).toHaveLength(1)
		);
	}
};

/** 3b · Schon zwei gestapelt: das Stapel-Symbol zeigt „3“ — die dritte Antwort. */
export const StackNumber: Story = {
	name: '3b · Stapel-Zahl: die dritte Antwort für die Supervision',
	args: {
		openRoom: 'supervision',
		collected: [P7_PASSAGES.letters, P7_PASSAGES.contract],
		preset: P7_PASSAGES.sleep,
		presetMode: 'popover',
		presetTarget: 'supervision'
	}
};

/** 4 · Drei Stellen gesammelt — gesendet wird erst im Seitenchat. */
export const ThreeCollected: Story = {
	name: '4 · Drei Stellen in der Supervision gesammelt',
	args: { openRoom: 'supervision', collected: ALL_THREE }
};

/** 5 · Gesendet: eine Nachricht, drei Zitate; Klick springt zur Stelle. */
export const SentToSupervision: Story = {
	name: '5 · Gesendet — eine Nachricht mit drei Zitaten',
	args: {
		openRoom: 'supervision',
		sent: {
			passages: ALL_THREE,
			text: 'Drei Stellen aus dem heutigen Kontakt — wie würdest du die Schlafprobleme ansprechen?'
		}
	}
};

/** 6 · Dasselbe in den Team-Chat einer Anfrage; Anruf im Kopf des Team-Chats. */
export const TeamChatWithCall: Story = {
	name: '6 · Team-Chat: gesammelte Stellen + Gruppenanruf',
	args: {
		openRoom: 'team',
		collected: [P7_PASSAGES.letters, P7_PASSAGES.contract],
		// Wide enough for the call buttons in the row (narrow: under ⋮).
		panelWidth: 560
	},
	play: async ({ canvasElement }) => {
		const panel = await waitForSelector(
			canvasElement,
			'[data-side-room="team"]'
		);
		await expect(
			panel.querySelector('[data-cy="panel-call-actions"]')
		).toBeTruthy();
	}
};

/** 7 · Ohne Team-Chat (#2491 ausgeschaltet): der Eintrag fehlt in der Leiste. */
export const WithoutTeamChat: Story = {
	name: '7 · Team-Chat aus → nur „In Supervision antworten“',
	args: { preset: P7_PASSAGES.sleep, withTeam: false }
};

/* ---------------------------------------------------------------------------
 * Variante: Antwort-Griff + Sprechblasen-Menü (Frank, 23.11.).
 * ------------------------------------------------------------------------- */

/** V1 · Text markiert: nur ein kleiner Griff oben rechts an der Stelle. */
export const BubbleHandle: Story = {
	name: 'Variante 1 · Griff oben rechts an der markierten Stelle',
	args: { preset: P7_PASSAGES.sleep, menu: 'bubble' },
	play: async ({ canvasElement }) => {
		await waitForSelector(
			canvasElement,
			'[data-cy="selection-reply-handle"]'
		);
		await expect(
			canvasElement.querySelector('[data-cy="selection-reply-toolbar"]')
		).toBeNull();
	}
};

/** V2 · Griff angeklickt: ein Sprechblasen-Menü mit allem. */
export const BubbleMenu: Story = {
	name: 'Variante 2 · Sprechblasen-Menü: schreiben, sammeln, senden, Ziele',
	args: { preset: P7_PASSAGES.sleep, menu: 'bubble', presetMode: 'popover' },
	play: async ({ canvasElement }) => {
		const bubble = await waitForSelector(
			canvasElement,
			'.selectionReply__popover--bubble'
		);
		await expect(
			within(bubble).getByRole('button', {
				name: 'In Supervision antworten'
			})
		).toBeTruthy();
		await expect(
			within(bubble).getByRole('button', {
				name: 'Im Team-Chat antworten'
			})
		).toBeTruthy();
	}
};

/* ---------------------------------------------------------------------------
 * Markieren und sammeln IN den Seitenchats und im Thread.
 * ------------------------------------------------------------------------- */

/** S1 · In der Supervision eine Stelle der Supervisorin markieren und beantworten. */
export const MarkInSupervision: Story = {
	name: 'Im Seitenchat 1 · In der Supervision markieren und antworten',
	args: {
		openRoom: 'supervision',
		presetRoom: 'supervision',
		preset: P7_PASSAGES.supervisorAdvice,
		presetMode: 'popover'
	}
};

/** S2 · Im Team-Chat Stellen von zwei Kolleg:innen gesammelt — jedes Zitat nennt die Person. */
export const CollectInTeamChat: Story = {
	name: 'Im Seitenchat 2 · Team-Chat: Stellen verschiedener Personen gesammelt',
	args: {
		openRoom: 'team',
		panelWidth: 560,
		collected: [
			{ ...P7_PASSAGES.teamAdvice, author: 'Jonas K.' },
			{
				eventId: '$t3',
				excerpt: 'noch zwei Termine frei',
				author: 'Aylin D.'
			}
		]
	}
};

/** S3 · Im Thread: dieselbe Leiste, dasselbe Sammeln — der Thread ist ein vollständiger Chat. */
export const MarkInThread: Story = {
	name: 'Im Seitenchat 3 · Im Thread markieren und antworten',
	args: {
		openRoom: 'thread',
		presetRoom: 'thread',
		preset: P7_PASSAGES.threadReply,
		presetMode: 'popover'
	}
};

/** 8 · ⋮ der Supervision: Anrufe, Supervisor:in ändern, Termin vereinbaren. */
export const SupervisionMenu: Story = {
	name: '8 · Supervision ⋮: Anruf, Supervisor:in ändern, Termin',
	args: { openRoom: 'supervision' },
	play: async ({ canvasElement }) => {
		const panel = await waitForSelector(
			canvasElement,
			'[data-side-room="supervision"]'
		);
		await userEvent.click(
			await waitForSelector(panel, '[data-cy="panel-call-menu-trigger"]')
		);
		const menu = await waitForSelector(
			panel,
			'[data-cy="panel-call-menu"]'
		);
		await expect(
			menu.querySelector('[data-cy="panel-menu-change-supervisor"]')
		).toBeTruthy();
		await expect(
			menu.querySelector('[data-cy="panel-menu-book-appointment"]')
		).toBeTruthy();
	}
};

/**
 * 9 · Sprachnachricht in die Supervision: Mikrofon ersetzt das Feld,
 * Pause statt Stopp, Senden beendet die Aufnahme selbst und schickt sie mit.
 */
export const VoiceIntoSupervision: Story = {
	name: '9 · Sprachnachricht in die Supervision — Senden stoppt die Aufnahme',
	args: { preset: P7_PASSAGES.letters },
	play: async ({ canvasElement }) => {
		const bar = await waitForSelector(
			canvasElement,
			'[data-cy="selection-reply-toolbar"]'
		);
		await userEvent.click(
			within(bar).getByRole('button', {
				name: 'In Supervision antworten'
			})
		);
		const popover = await waitForSelector(
			canvasElement,
			'[data-cy="selection-reply-popover"]'
		);
		await userEvent.click(
			within(popover).getByRole('button', {
				name: 'Mit Sprachnachricht antworten'
			})
		);
		// The voice note takes the field's place; Pause, not Stop.
		await waitFor(() =>
			expect(popover.querySelector('.selectionReply__input')).toBeNull()
		);
		await expect(
			within(popover).getByRole('button', { name: 'Aufnahme pausieren' })
		).toBeTruthy();
		// One recorded second makes it an answer.
		await waitFor(
			() =>
				expect(
					popover
						.querySelector('.sendButton')
						?.getAttribute('disabled')
				).toBeNull(),
			{ timeout: 3000 }
		);
		await userEvent.click(
			popover.querySelector<HTMLElement>('.sendButton')!
		);
		const panel = await waitForSelector(
			canvasElement,
			'[data-side-room="supervision"]'
		);
		await waitFor(() =>
			expect(panel.querySelector('.voicePlayer')).toBeTruthy()
		);
	}
};
