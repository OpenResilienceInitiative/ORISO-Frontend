// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalLinkButton } from './LegalLinkButton';

const tenant = {
	content: {} as Record<string, unknown>
};

vi.mock('../../globalState/provider/TenantProvider', () => ({
	useTenant: () => tenant
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	}),
	Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>
}));

const renderButton = (label = 'Impressum', rawLabel?: string) =>
	render(
		<LegalLinkButton
			label={label}
			rawLabel={rawLabel}
			url="https://example.test/impressum"
		/>
	);

afterEach(() => {
	cleanup();
	tenant.content = {};
	vi.restoreAllMocks();
});

describe('LegalLinkButton', () => {
	it('opens the note instead of a new tab', () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);

		renderButton();
		fireEvent.click(screen.getByRole('button', { name: 'Impressum' }));

		expect(open).not.toHaveBeenCalled();
		expect(screen.getByText('login.legal.platform.impressum')).toBeTruthy();
	});

	it('shows the platform note, not the carrier text', () => {
		// A carrier text exists — and must still not be shown here, because on
		// this surface the visitor has not chosen a Beratungsstelle.
		tenant.content = { impressum: '<p>Angaben gemäß § 5 TMG</p>' };

		renderButton();
		fireEvent.click(screen.getByRole('button', { name: 'Impressum' }));

		expect(screen.getByText('login.legal.platform.impressum')).toBeTruthy();
		expect(screen.queryByText(/Angaben gemäß/)).toBeNull();
	});

	it('picks the privacy note from the untranslated key', () => {
		renderButton(
			'Politique de confidentialité',
			'login.legal.infoText.dataprotection'
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Politique de confidentialité' })
		);

		expect(
			screen.getByText('login.legal.platform.dataprotection')
		).toBeTruthy();
	});

	it('keeps the full binding document one click away', () => {
		renderButton();
		fireEvent.click(screen.getByRole('button', { name: 'Impressum' }));

		const fullText = screen.getByText('login.legal.platform.fullText');
		expect(fullText.getAttribute('href')).toBe(
			'https://example.test/impressum'
		);
		expect(fullText.getAttribute('target')).toBe('_blank');
		expect(fullText.getAttribute('rel')).toBe('noopener noreferrer');
	});

	it('opens the note even when no carrier text is authored', () => {
		// The note ships in the catalogue, so there is no empty-dialog case and
		// no reason to bounce the visitor into a new tab.
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);

		renderButton();
		fireEvent.click(screen.getByRole('button', { name: 'Impressum' }));

		expect(open).not.toHaveBeenCalled();
		expect(screen.getByText('login.legal.platform.impressum')).toBeTruthy();
	});
});
