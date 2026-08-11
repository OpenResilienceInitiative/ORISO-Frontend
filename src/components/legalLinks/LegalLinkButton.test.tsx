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

const renderButton = () =>
	render(
		<LegalLinkButton
			label="Impressum"
			url="https://example.test/impressum"
		/>
	);

afterEach(() => {
	cleanup();
	tenant.content = {};
	vi.restoreAllMocks();
});

describe('LegalLinkButton', () => {
	it('opens the authored text in a dialog instead of a new tab', async () => {
		tenant.content = { impressum: '<p>Angaben gemäß § 5 TMG</p>' };
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);

		renderButton();
		fireEvent.click(screen.getByRole('button', { name: 'Impressum' }));

		expect(open).not.toHaveBeenCalled();
		expect(await screen.findByRole('dialog')).toBeTruthy();
	});

	it('falls back to the configured legal URL when no text is authored', async () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);

		renderButton();
		fireEvent.click(screen.getByRole('button', { name: 'Impressum' }));

		expect(open).toHaveBeenCalledWith(
			'https://example.test/impressum',
			'_blank',
			'noopener,noreferrer'
		);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('treats an empty authored text as not authored', async () => {
		tenant.content = { impressum: '   ' };
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);

		renderButton();
		fireEvent.click(screen.getByRole('button', { name: 'Impressum' }));

		expect(open).toHaveBeenCalled();
	});
});
