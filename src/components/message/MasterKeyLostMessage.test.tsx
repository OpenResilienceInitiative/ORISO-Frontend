// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it, vi } from 'vitest';
import de from '../../resources/i18n/de/common.json';
// jsdom has no canvas. The unrelated third-party animation boundary is not
// part of this notice seam; its actual recovery UI is covered in Chromium.
vi.mock('lottie-react', () => ({ default: () => null }));
import { MasterKeyLostMessage } from './MasterKeyLostMessage';

const i18n = createInstance();
await i18n.init({
	lng: 'de',
	defaultNS: 'common',
	resources: { de: { common: de } }
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

it('keeps the room-key history notice visible without a dismissal or timeout', () => {
	vi.useFakeTimers();
	render(
		<I18nextProvider i18n={i18n}>
			<MasterKeyLostMessage subscriptionKeyLost />
		</I18nextProvider>
	);
	expect(screen.getByRole('status').textContent).toBe(
		de.e2ee.subscriptionKeyLost.message.primary
	);
	expect(screen.queryByRole('button')).toBeNull();
	act(() => {
		vi.advanceTimersByTime(120000);
	});
	expect(screen.getByRole('status').textContent).toBe(
		de.e2ee.subscriptionKeyLost.message.primary
	);
});

it('preserves restored-access history wording and its explanation action', () => {
	render(
		<I18nextProvider i18n={i18n}>
			<MasterKeyLostMessage subscriptionKeyLost={false} />
		</I18nextProvider>
	);
	expect(screen.getByRole('status').textContent).toContain(
		de.e2ee.subscriptionKeyLost.message.secondary
	);
	expect(screen.getAllByRole('button')).toHaveLength(1);
	expect(
		screen.getByRole('button', {
			name: de.e2ee.subscriptionKeyLost.message.more
		})
	).toBeTruthy();
});
