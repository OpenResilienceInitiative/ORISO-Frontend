// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { vi } from 'vitest';
import { LiveChatChecking } from './LiveChatChecking';

vi.mock('../../orbitalTrails/OrbitalTrails', () => ({
	OrbitalTrails: () => <canvas />
}));
afterEach(() => cleanup());

/* The words on screen are what changes ("wir schauen" → "wir warten"), so they
   are the live region; the animation says nothing and is hidden. */
it('announces the visible sentence once, and hides the animation', () => {
	const { container } = render(
		<LiveChatChecking text="Wir schauen, wer gerade live ist …" />
	);

	const status = screen.getAllByRole('status');
	expect(status).toHaveLength(1);
	expect(status[0].textContent).toBe('Wir schauen, wer gerade live ist …');
	expect(status[0].getAttribute('aria-live')).toBe('polite');
	expect(
		container.querySelector('canvas')?.closest('[aria-hidden="true"]')
	).not.toBeNull();
});
