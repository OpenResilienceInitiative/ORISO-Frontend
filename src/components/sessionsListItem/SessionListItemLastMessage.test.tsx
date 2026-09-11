// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionListItemLastMessage } from './SessionListItemLastMessage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

describe('SessionListItemLastMessage', () => {
	it('renders transport-stored rich text as a readable preview', () => {
		render(
			<SessionListItemLastMessage lastMessage="[[align:left]]<p>Wir haben die Zwei-Minuten-Runde ausprobiert.</p>[[/align]]" />
		);

		expect(
			screen.getByText('Wir haben die Zwei-Minuten-Runde ausprobiert.')
		).not.toBeNull();
		expect(screen.queryByText(/\[\[align:left\]\]|<p>/i)).toBeNull();
	});

	it('keeps the language prefix while removing visibility and highlight markup', () => {
		const { container } = render(
			<SessionListItemLastMessage
				lastMessage="[VISIBLE_TO:abc][[hl:#fff59d]]Wichtige Notiz[[/hl]]"
				language="de"
				showLanguage
			/>
		);

		expect(
			container
				.querySelector('.sessionsListItem__subject')
				?.textContent?.replace(/\s+/g, ' ')
		).toBe('DE | Wichtige Notiz');
		expect(screen.queryByText(/VISIBLE_TO|\[\[hl:/i)).toBeNull();
	});
});
