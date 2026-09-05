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
	hasPendingChange: boolean,
	onLeave = vi.fn()
): { onLeave: ReturnType<typeof vi.fn> } => {
	const value: AskerInfoActionContextValue = {
		hasPendingChange,
		setHasPendingChange: vi.fn()
	};
	render(
		<AskerInfoActionContext.Provider value={value}>
			<AskerInfoFooter onLeave={onLeave} />
		</AskerInfoActionContext.Provider>
	);
	return { onLeave };
};

const nextButton = () =>
	screen.getByRole('button', { name: 'Weiter' }) as HTMLButtonElement;
const backButton = () =>
	screen.getByRole('button', { name: 'Zurück' }) as HTMLButtonElement;

describe('AskerInfoFooter (#1192)', () => {
	afterEach(cleanup);

	// "Back is always active" — leaving the profile is never gated on what the
	// user did or did not change.
	it('keeps back active whether or not the allocation changed', () => {
		const { onLeave } = renderFooter(false);

		expect(backButton().disabled).toBe(false);
		fireEvent.click(backButton());
		expect(onLeave).toHaveBeenCalledTimes(1);
	});

	it('leaves next inert and non-primary while nothing changed', () => {
		renderFooter(false);

		expect(nextButton().disabled).toBe(true);
		expect(nextButton().className).not.toContain(
			'askerInfo__footer__button--primary'
		);
	});

	it('promotes next to primary once an allocation was picked', () => {
		const { onLeave } = renderFooter(true);

		expect(nextButton().disabled).toBe(false);
		expect(nextButton().className).toContain(
			'askerInfo__footer__button--primary'
		);

		fireEvent.click(nextButton());
		expect(onLeave).toHaveBeenCalledTimes(1);
	});

	// A disabled button that still fired would navigate away from a profile the
	// user had not finished with.
	it('does not act while next is inert', () => {
		const { onLeave } = renderFooter(false);

		fireEvent.click(nextButton());
		expect(onLeave).not.toHaveBeenCalled();
	});
});
