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
					'FE#2494 *7 (mit *8 „Stacked Reply“). Text im Chat mit der Ratsuchenden markieren → die bekannte Leiste, vereinfacht: **Antworten · In Supervision antworten · Im Team-Chat antworten · Thread** (Schwärzen nur für Moderierende). Die Sprachnachricht ist keine eigene Aktion mehr — das Mikrofon sitzt im Antwort-Feld.',
					'Ein Klick auf „In Supervision antworten“ oder „Im Team-Chat antworten“ öffnet diesen Seitenchat und legt die Stelle als Zitat in **dessen** Eingabe. Weitere Stellen sammeln sich dort. Gesendet wird nur im Seitenchat — die Eingabe der Ratsuchenden hat keinen Ziel-Umschalter, also geht nichts versehentlich an sie.',
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
			'Antworten',
			'In Supervision antworten',
			'Im Team-Chat antworten',
			'Thread'
		]);
	}
};

/** 2 · „Antworten“ im selben Chat: Mikrofon im Feld, „Sammeln“ dunkelgrau, Senden rot. */
export const ReplyField: Story = {
	name: '2 · Antwort-Feld: Mikrofon im Feld, „Sammeln“ statt „+“',
	args: { preset: P7_PASSAGES.sleep, presetMode: 'popover' }
};

/** 3 · Ein Klick auf „In Supervision antworten“ öffnet die Supervision mit dem Zitat. */
export const IntoSupervision: Story = {
	name: '3 · Klick → Supervision öffnet, Zitat liegt in ihrer Eingabe',
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
