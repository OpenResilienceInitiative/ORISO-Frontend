// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecoveryKeySaveStep } from './RecoveryKeySaveStep';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

afterEach(cleanup);

describe('RecoveryKeySaveStep', () => {
	it('shows the key and keeps Fertig disabled until the person confirms they stored it', () => {
		const onConfirm = vi.fn();
		render(
			<RecoveryKeySaveStep
				recoveryKey="esc-key-abc"
				onConfirm={onConfirm}
			/>
		);

		expect(screen.getByText('esc-key-abc')).toBeTruthy();
		const done = screen.getByRole('button', { name: 'Fertig' });
		expect(done.className).toMatch(/button__item--disabled/);
		fireEvent.click(done);
		expect(onConfirm).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole('checkbox', {
				name: 'Ich habe den Schlüssel sicher gespeichert.'
			})
		);
		fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it('uses the silent-setup explainer when the key was parked at login', () => {
		render(
			<RecoveryKeySaveStep
				fromSilentSetup
				recoveryKey="parked"
				onConfirm={vi.fn()}
			/>
		);

		expect(
			screen.getByText(/beim Anmelden automatisch eingerichtet/i)
		).toBeTruthy();
	});
});
