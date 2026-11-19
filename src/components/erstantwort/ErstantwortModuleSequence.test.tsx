// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { ErstantwortModuleSequence } from './ErstantwortModuleSequence';
import type { ErstantwortSection } from './erstantwortModulePayload';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string | Record<string, unknown>) =>
			typeof fallback === 'string' ? fallback : key
	})
}));

afterEach(cleanup);

const greeting: ErstantwortSection = {
	id: 'greeting',
	kind: 'message',
	body: 'Schön, dass Sie sich gemeldet haben.'
};
const whoReadsAlong: ErstantwortSection = {
	id: 'whoReadsAlong',
	kind: 'panel',
	title: 'Wer liest mit?',
	display: 'collapsed',
	body: 'Nur Ihre Beratungsstelle.'
};
const responseTime: ErstantwortSection = {
	id: 'responseTime',
	kind: 'panel',
	title: 'Wann Sie eine Antwort erhalten',
	display: 'open',
	body: 'Innerhalb von 2 Werktagen.'
};
const emergency: ErstantwortSection = {
	id: 'emergency',
	kind: 'panel',
	title: 'Notfallnummern',
	display: 'collapsed',
	body: 'Telefonseelsorge 0800 111 0 111',
	safety: true
};
const email: ErstantwortSection = {
	id: 'email',
	kind: 'fixed',
	module: 'email'
};
const questions: ErstantwortSection = {
	id: 'intake',
	kind: 'questions',
	title: 'Ein paar Fragen vorab',
	display: 'open',
	trigger: 'withGreeting',
	questions: [
		{
			id: 'age',
			version: 1,
			type: 'single',
			display: 'radio',
			required: true,
			label: 'Wie alt sind Sie?',
			options: [
				{ id: 'u18', label: 'unter 18' },
				{ id: 'o18', label: '18 oder älter' }
			]
		},
		{
			id: 'state',
			version: 2,
			type: 'single',
			display: 'dropdown',
			required: false,
			label: 'Bundesland',
			options: [
				{ id: 'by', label: 'Bayern' },
				{ id: 'be', label: 'Berlin' }
			]
		},
		{
			id: 'topics',
			version: 1,
			type: 'multi',
			required: false,
			label: 'Worum geht es?',
			options: [
				{ id: 'money', label: 'Geld' },
				{ id: 'family', label: 'Familie' }
			]
		},
		{
			id: 'note',
			version: 1,
			type: 'hint',
			required: false,
			label: 'Alle Angaben sind freiwillig, außer markierte.',
			options: []
		},
		{
			id: 'more',
			version: 1,
			type: 'text',
			required: false,
			label: 'Möchten Sie noch etwas sagen?',
			options: []
		}
	]
};

describe('ErstantwortModuleSequence (ADR-036, version-2 payload)', () => {
	it('draws messages and panels in the editor order as one message', () => {
		render(
			<ErstantwortModuleSequence
				sections={[greeting, whoReadsAlong, responseTime, emergency]}
			/>
		);
		const bubbles = screen.getAllByTestId('erstantwort-module-bubble');
		expect(bubbles).toHaveLength(1);
		const text = bubbles[0].textContent ?? '';
		expect(text.indexOf('Schön')).toBeLessThan(
			text.indexOf('Wer liest mit?')
		);
		expect(text.indexOf('Wer liest mit?')).toBeLessThan(
			text.indexOf('Wann Sie eine Antwort')
		);
	});

	it('shows an open panel as text and a collapsed one as a closed disclosure', () => {
		render(
			<ErstantwortModuleSequence
				sections={[greeting, whoReadsAlong, responseTime]}
			/>
		);
		const collapsed = screen.getByText('Wer liest mit?').closest('details');
		expect(collapsed).not.toBeNull();
		expect(collapsed!.open).toBe(false);
		expect(
			screen
				.getByText('Wann Sie eine Antwort erhalten')
				.closest('details')
		).toBeNull();
		expect(screen.getByText('Innerhalb von 2 Werktagen.')).toBeTruthy();
	});

	it('marks a safety panel as the emergency row, wherever the editor put it', () => {
		render(<ErstantwortModuleSequence sections={[emergency, greeting]} />);
		const row = screen.getByText('Notfallnummern').closest('details');
		expect(row!.className).toContain('erstantwort__faq--emergency');
	});

	it('renders a fixed module from its slot, and nothing without one', () => {
		const { rerender } = render(
			<ErstantwortModuleSequence
				sections={[greeting, email]}
				slots={{ email: <p>E-Mail-Karte</p> }}
			/>
		);
		expect(screen.getByText('E-Mail-Karte')).toBeTruthy();
		expect(screen.getAllByTestId('erstantwort-module-bubble')).toHaveLength(
			2
		);
		rerender(<ErstantwortModuleSequence sections={[greeting, email]} />);
		expect(screen.getAllByTestId('erstantwort-module-bubble')).toHaveLength(
			1
		);
	});

	it('renders every question type of a question block in its own bubble', () => {
		render(
			<ErstantwortModuleSequence
				sections={[greeting, questions]}
				onAnswer={() => undefined}
			/>
		);
		const block = screen.getByTestId('erstantwort-questions-intake');
		expect(within(block).getAllByRole('radio')).toHaveLength(2);
		expect(
			within(block).getByRole('combobox', { name: /Bundesland/ })
		).toBeTruthy();
		expect(within(block).getAllByRole('checkbox')).toHaveLength(2);
		expect(
			within(block).getByRole('textbox', {
				name: 'Möchten Sie noch etwas sagen?'
			})
		).toBeTruthy();
		expect(
			within(block).getByText(
				'Alle Angaben sind freiwillig, außer markierte.'
			)
		).toBeTruthy();
	});

	it('blocks sending while a required question is open, and names it', () => {
		const onAnswer = vi.fn();
		render(
			<ErstantwortModuleSequence
				sections={[questions]}
				onAnswer={onAnswer}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Antworten senden' })
		);
		expect(onAnswer).not.toHaveBeenCalled();
		const group = screen.getByRole('radiogroup', {
			name: /Wie alt sind Sie\?/
		});
		expect(group.getAttribute('aria-invalid')).toBe('true');
		expect(
			screen.getByText('Bitte beantworten Sie diese Frage.')
		).toBeTruthy();
	});

	it('sends the answers with each question id and version, then thanks the person', async () => {
		const onAnswer = vi.fn();
		render(
			<ErstantwortModuleSequence
				sections={[questions]}
				onAnswer={onAnswer}
			/>
		);
		fireEvent.click(screen.getByRole('radio', { name: '18 oder älter' }));
		fireEvent.mouseDown(
			screen.getByRole('combobox', { name: /Bundesland/ })
		);
		fireEvent.click(screen.getByRole('option', { name: 'Berlin' }));
		fireEvent.click(screen.getByRole('checkbox', { name: 'Familie' }));
		fireEvent.click(
			screen.getByRole('button', { name: 'Antworten senden' })
		);
		expect(onAnswer).toHaveBeenCalledWith('intake', [
			{ questionId: 'age', version: 1, value: 'o18' },
			{ questionId: 'state', version: 2, value: 'be' },
			{ questionId: 'topics', version: 1, value: ['family'] }
		]);
		// Thanks only once the send went through.
		expect(
			await screen.findByText('Danke für Ihre Antworten.')
		).toBeTruthy();
		expect(
			screen.queryByRole('button', { name: 'Antworten senden' })
		).toBeNull();
	});

	it('keeps the answers and says so when sending fails', async () => {
		const onAnswer = vi.fn().mockRejectedValue(new Error('offline'));
		render(
			<ErstantwortModuleSequence
				sections={[questions]}
				onAnswer={onAnswer}
			/>
		);
		fireEvent.click(screen.getByRole('radio', { name: '18 oder älter' }));
		fireEvent.click(
			screen.getByRole('button', { name: 'Antworten senden' })
		);
		expect(await screen.findByRole('alert')).toBeTruthy();
		expect(screen.queryByText('Danke für Ihre Antworten.')).toBeNull();
		expect(
			(
				screen.getByRole('radio', {
					name: '18 oder älter'
				}) as HTMLInputElement
			).checked
		).toBe(true);
	});

	it('offers no send button without a handler, and shows answered blocks as done', () => {
		const { rerender } = render(
			<ErstantwortModuleSequence sections={[questions]} />
		);
		expect(
			screen.queryByRole('button', { name: 'Antworten senden' })
		).toBeNull();
		rerender(
			<ErstantwortModuleSequence
				sections={[questions]}
				onAnswer={() => undefined}
				answeredSectionIds={['intake']}
			/>
		);
		expect(screen.getByText('Danke für Ihre Antworten.')).toBeTruthy();
	});

	it('holds a block triggered after the first reply until the counsellor has replied', () => {
		const later: ErstantwortSection = {
			...questions,
			trigger: 'afterFirstReply'
		};
		const { rerender } = render(
			<ErstantwortModuleSequence
				sections={[greeting, later]}
				onAnswer={() => undefined}
			/>
		);
		expect(screen.queryByTestId('erstantwort-questions-intake')).toBeNull();
		rerender(
			<ErstantwortModuleSequence
				sections={[greeting, later]}
				onAnswer={() => undefined}
				counsellorReplied
			/>
		);
		expect(screen.getByTestId('erstantwort-questions-intake')).toBeTruthy();
	});

	it('renders nothing for an empty module', () => {
		const { container } = render(
			<ErstantwortModuleSequence sections={[]} />
		);
		expect(container.innerHTML).toBe('');
	});
});
