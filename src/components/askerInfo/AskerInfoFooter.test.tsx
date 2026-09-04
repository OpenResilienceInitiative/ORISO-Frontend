// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AskerInfoFooter } from './AskerInfoFooter';
import {
	AskerInfoActionContext,
	AskerInfoActionContextValue
} from './askerInfoActionContext';

const TRANSLATIONS: Record<string, string> = {
	'app.back': 'Zurück',
	'app.next': 'Weiter'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) =>
			TRANSLATIONS[key] ?? fallback ?? key,
		i18n: { language: 'de' }
	})
}));

const renderFooter = (
	overrides: Partial<AskerInfoActionContextValue> = {},
	onBack = vi.fn()
) => {
	const value: AskerInfoActionContextValue = {
		hasPendingChange: false,
		setHasPendingChange: vi.fn(),
		confirmNonce: 0,
		requestConfirm: vi.fn(),
		...overrides
	};
	render(
		<AskerInfoActionContext.Provider value={value}>
			<AskerInfoFooter onBack={onBack} />
		</AskerInfoActionContext.Provider>
	);
	return { value, onBack };
};

const nextButton = () =>
	screen.getByRole('button', { name: 'Weiter' }) as HTMLButtonElement;
const backButton = () =>
	screen.getByRole('button', { name: 'Zurück' }) as HTMLButtonElement;

describe('AskerInfoFooter (#1192)', () => {
	afterEach(cleanup);

	// Leaving the profile is never gated on what the user did or did not
	// change — the issue calls for "back always active".
	it('keeps the back button active whether or not something changed', () => {
		const { onBack } = renderFooter({ hasPendingChange: false });

		expect(backButton().disabled).toBe(false);
		fireEvent.click(backButton());
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('leaves next inert and secondary while nothing actionable changed', () => {
		renderFooter({ hasPendingChange: false });

		expect(nextButton().disabled).toBe(true);
		expect(nextButton().className).not.toContain(
			'askerInfo__footer__button--primary'
		);
	});

	it('promotes next to primary once an allocation was picked', () => {
		const requestConfirm = vi.fn();
		renderFooter({ hasPendingChange: true, requestConfirm });

		expect(nextButton().disabled).toBe(false);
		expect(nextButton().className).toContain(
			'askerInfo__footer__button--primary'
		);

		fireEvent.click(nextButton());
		expect(requestConfirm).toHaveBeenCalledTimes(1);
	});

	// A disabled button that still fires would raise the assign overlay for a
	// selection the user never made.
	it('does not ask for confirmation while next is inert', () => {
		const requestConfirm = vi.fn();
		renderFooter({ hasPendingChange: false, requestConfirm });

		fireEvent.click(nextButton());
		expect(requestConfirm).not.toHaveBeenCalled();
	});
});
