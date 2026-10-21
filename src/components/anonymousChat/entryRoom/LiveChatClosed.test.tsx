// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LiveChatClosed } from './LiveChatClosed';

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/* On a phone the footer's round variant shows only a close icon. "Ich warte"
   keeps the page open, so an X would say the opposite of what it does. */
it('shows "Ich warte" as words on a phone, not as a close icon', () => {
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('max-width'),
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		onchange: null,
		dispatchEvent: () => false
	}));
	render(
		<LiveChatClosed
			onMailCounselling={() => undefined}
			onLater={() => undefined}
		/>
	);

	const wait = screen.getByRole('button', { name: 'Ich warte' });
	expect(wait.textContent).toContain('Ich warte');
	expect(wait.querySelector('[data-testid="CloseRoundedIcon"]')).toBeNull();
});
