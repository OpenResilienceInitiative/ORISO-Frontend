import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { ErstantwortModuleSequence } from './ErstantwortModuleSequence';
import { NotificationChoiceCard } from './NotificationChoiceCard';
import {
	ERSTANTWORT_MODULE_PAYLOAD_VERSION,
	parseErstantwortModule,
	type ErstantwortSection
} from './erstantwortModulePayload';
import { SYSTEM_NOTIFICATION_FIRST_RESPONSE } from './erstantwortPayload';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import { phone390Globals } from '../message/messageStoryShell';
import './ErstantwortSequence.styles.scss';

/**
 * **Erstantwort, version 2** (ADR-036): the resolved conversation module as the
 * person sees it in the chat.
 *
 * Every story below starts from a raw `[SYSTEM_NOTIFICATION]` event and runs it
 * through `parseErstantwortModule`, exactly as the chat will — so a story that
 * renders is a payload the parser accepts.
 *
 * What to check:
 * - **Order is the editor's.** Messages and panels share one bubble; a fixed
 *   module or a question block gets its own.
 * - **Open vs. collapsed.** An open panel is a headline with its text; a
 *   collapsed one is a row that expands on tap.
 * - **Question block.** Free text, single select as radio buttons or as a
 *   select field, multi select and a hint; required questions say so in words.
 */
const meta = {
	id: 'components-chat-erstantwort-module',
	title: 'Chat/System messages/First response v2 (conversation module)',
	component: ErstantwortModuleSequence,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	args: { sections: [], onAnswer: fn() }
} satisfies Meta<typeof ErstantwortModuleSequence>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Builds the raw event and parses it, like the chat does. */
const fromEvent = (sections: unknown[]): ErstantwortSection[] => {
	const raw = `${SYSTEM_NOTIFICATION_PREFIX} ${JSON.stringify({
		type: SYSTEM_NOTIFICATION_FIRST_RESPONSE,
		version: ERSTANTWORT_MODULE_PAYLOAD_VERSION,
		conversationType: 'AGENCY_COUNSELLING',
		sections
	})}`;
	return parseErstantwortModule(raw).sections;
};

/* The Mailberatung prototype shipped in the Admin configurator, German. */
const greeting = {
	id: 'greeting',
	kind: 'message',
	body: 'Schön, dass Sie sich gemeldet haben. Ihre Nachricht ist bei uns angekommen.'
};
const whoReadsAlong = {
	id: 'whoReadsAlong',
	kind: 'panel',
	title: 'Wer liest Ihre Nachricht?',
	display: 'collapsed',
	body: 'Ihre Nachricht lesen nur die Beraterinnen und Berater dieser Beratungsstelle.'
};
const responseTime = {
	id: 'responseTime',
	kind: 'message',
	body: 'Sie bekommen innerhalb von zwei Werktagen eine Antwort.'
};
const emergency = {
	id: 'emergencyNumbers',
	kind: 'panel',
	title: 'In einer akuten Notlage',
	display: 'collapsed',
	safety: true,
	body: 'Rund um die Uhr erreichen Sie die Telefonseelsorge unter 0800 111 0 111 oder 0800 111 0 222. Bei Lebensgefahr wählen Sie 112.'
};
const email = {
	id: 'email',
	kind: 'fixed',
	module: 'email',
	title: 'Benachrichtigung per E-Mail'
};
const closing = {
	id: 'closing',
	kind: 'message',
	body: 'Bis bald – wir melden uns bei Ihnen.'
};

const intake = {
	id: 'intake',
	kind: 'questions',
	title: 'Ein paar Fragen vorab',
	display: 'open',
	trigger: 'withGreeting',
	questions: [
		{
			id: 'hint',
			version: 1,
			type: 'hint',
			label: 'Ihre Antworten helfen der Beratungsstelle, sich vorzubereiten. Nur die markierte Frage ist nötig.'
		},
		{
			id: 'age',
			version: 1,
			type: 'single',
			display: 'radio',
			required: true,
			label: 'Wie alt sind Sie?',
			options: [
				{ id: 'u18', label: 'unter 18' },
				{ id: '18to26', label: '18 bis 26' },
				{ id: 'o26', label: 'älter als 26' }
			]
		},
		{
			id: 'state',
			version: 1,
			type: 'single',
			display: 'dropdown',
			label: 'In welchem Bundesland wohnen Sie?',
			help: 'Damit wir Ihnen Angebote in Ihrer Nähe nennen können.',
			options: [
				{ id: 'bw', label: 'Baden-Württemberg' },
				{ id: 'by', label: 'Bayern' },
				{ id: 'be', label: 'Berlin' },
				{ id: 'nw', label: 'Nordrhein-Westfalen' }
			]
		},
		{
			id: 'topics',
			version: 1,
			type: 'multi',
			label: 'Worum geht es Ihnen?',
			options: [
				{ id: 'money', label: 'Geld und Schulden' },
				{ id: 'family', label: 'Familie' },
				{ id: 'housing', label: 'Wohnen' }
			]
		},
		{
			id: 'more',
			version: 1,
			type: 'text',
			label: 'Möchten Sie noch etwas ergänzen?'
		}
	]
};

const survey = {
	id: 'survey',
	kind: 'questions',
	title: 'Wie war die Beratung für Sie?',
	display: 'open',
	trigger: 'withGreeting',
	questions: [
		{
			id: 'helped',
			version: 1,
			type: 'single',
			display: 'radio',
			label: 'Hat Ihnen die Beratung geholfen?',
			options: [
				{ id: 'yes', label: 'Ja' },
				{ id: 'partly', label: 'Teilweise' },
				{ id: 'no', label: 'Nein' }
			]
		},
		{
			id: 'whatHelped',
			version: 1,
			type: 'multi',
			label: 'Was war für Sie hilfreich?',
			options: [
				{ id: 'listening', label: 'Dass mir jemand zugehört hat' },
				{ id: 'information', label: 'Informationen' },
				{ id: 'nextSteps', label: 'Nächste Schritte' }
			]
		},
		{
			id: 'comment',
			version: 1,
			type: 'text',
			label: 'Möchten Sie uns noch etwas sagen?'
		}
	]
};

const emailSlot = {
	email: <NotificationChoiceCard onChoose={() => undefined} />
};

/** The shipped Mailberatung prototype, unchanged: greeting, two panels, e-mail, goodbye. */
export const MailberatungPrototype: Story = {
	args: {
		sections: fromEvent([
			greeting,
			whoReadsAlong,
			responseTime,
			emergency,
			email,
			closing
		]),
		slots: emailSlot
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bubbles = canvas.getAllByTestId('erstantwort-module-bubble');
		/* Message, e-mail module, then the goodbye as its own message. */
		await expect(bubbles).toHaveLength(3);
		const emergencyRow = canvas
			.getByText('In einer akuten Notlage')
			.closest('details');
		await expect(emergencyRow?.className).toContain(
			'erstantwort__faq--emergency'
		);
	}
};

/** A Beratungsstelle reordered the module and opened the emergency panel. */
export const ReorderedByCentre: Story = {
	args: {
		sections: fromEvent([
			greeting,
			{ ...emergency, display: 'open' },
			responseTime,
			whoReadsAlong,
			closing
		])
	}
};

/** The question block right after the enquiry, every question type. */
export const WithQuestionBlock: Story = {
	args: {
		sections: fromEvent([
			greeting,
			responseTime,
			intake,
			emergency,
			closing
		])
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const block = canvas.getByTestId('erstantwort-questions-intake');
		await expect(within(block).getAllByRole('radio')).toHaveLength(3);
		await expect(
			within(block).getByRole('combobox', {
				name: /In welchem Bundesland/
			})
		).toBeTruthy();
	}
};

/** Sending without the one required answer names the open question. */
export const RequiredQuestionMissing: Story = {
	args: { sections: fromEvent([intake]) },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Antworten senden' })
		);
		await expect(args.onAnswer).not.toHaveBeenCalled();
		await expect(
			canvas.getByText('Bitte beantworten Sie diese Frage.')
		).toBeTruthy();
	}
};

/** Answered: the block turns into a short thank-you. */
export const QuestionsAnswered: Story = {
	args: { sections: fromEvent([intake]) },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('radio', { name: '18 bis 26' }));
		await userEvent.click(
			canvas.getByRole('combobox', { name: /In welchem Bundesland/ })
		);
		/* The menu is a portal on the document body. */
		await userEvent.click(
			await within(canvasElement.ownerDocument.body).findByRole(
				'option',
				{ name: 'Berlin' }
			)
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Antworten senden' })
		);
		await expect(args.onAnswer).toHaveBeenCalledWith('intake', [
			{ questionId: 'age', version: 1, value: '18to26' },
			{ questionId: 'state', version: 1, value: 'be' }
		]);
		await expect(
			canvas.getByText('Danke für Ihre Antworten.')
		).toBeTruthy();
	}
};

/** Trigger "after the first reply": hidden until a counsellor has answered. */
export const AfterFirstReplyStillWaiting: Story = {
	args: {
		sections: fromEvent([
			greeting,
			responseTime,
			{ ...intake, trigger: 'afterFirstReply' },
			closing
		]),
		counsellorReplied: false
	},
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).queryByTestId('erstantwort-questions-intake')
		).toBeNull();
	}
};

/** The editor collapsed the question block: one row that opens on tap. */
export const CollapsedQuestionBlock: Story = {
	args: {
		sections: fromEvent([
			greeting,
			{ ...intake, display: 'collapsed' },
			closing
		])
	}
};

/** Moment 3: the follow-up survey uses the same question block. */
export const ClosingSurvey: Story = {
	args: {
		sections: fromEvent([
			{
				id: 'thanks',
				kind: 'message',
				body: 'Ihre Beratung ist abgeschlossen. Wenn Sie mögen, sagen Sie uns, wie es für Sie war.'
			},
			survey
		])
	}
};

/** Phone width, the question block in full. */
export const PhoneWithQuestionBlock: Story = {
	args: {
		sections: fromEvent([greeting, intake, emergency, closing])
	},
	globals: phone390Globals
};
