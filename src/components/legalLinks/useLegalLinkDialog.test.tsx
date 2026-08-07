// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { useLegalLinkDialog } from './useLegalLinkDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const IMPRINT_LABEL = 'login.legal.infoText.impressum';

const Harness = () => {
	const { openLegalLink, dialog } = useLegalLinkDialog();
	return (
		<>
			<button
				type="button"
				onClick={() =>
					openLegalLink(
						'Impressum',
						'https://example.invalid/imprint',
						IMPRINT_LABEL
					)
				}
			>
				open
			</button>
			{dialog}
		</>
	);
};

const renderWithTenant = (tenant: any) =>
	render(
		<TenantContext.Provider value={{ tenant } as any}>
			<Harness />
		</TenantContext.Provider>
	);

describe('useLegalLinkDialog', () => {
	beforeEach(() => {
		// This repo has no global auto-cleanup, so a previous render's tree
		// would still be in the document and every query would match twice.
		cleanup();
		vi.restoreAllMocks();
	});

	it('opens the tenant text in a dialog instead of a new tab', () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		renderWithTenant({
			content: { impressum: '<p>Träger-Impressum</p>' }
		});

		fireEvent.click(screen.getByText('open'));

		expect(open).not.toHaveBeenCalled();
		expect(screen.getByText('Träger-Impressum')).toBeTruthy();
	});

	it('falls back to the external link when the tenant maintains no text', () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		// An empty language map is what an unconfigured tenant delivers — it
		// must count as "nothing maintained", not as content.
		renderWithTenant({ content: { impressum: '', impressumLanguages: {} } });

		fireEvent.click(screen.getByText('open'));

		expect(open).toHaveBeenCalledWith(
			'https://example.invalid/imprint',
			'_blank',
			'noopener'
		);
	});

	it('falls back when no tenant is present at all', () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		render(<Harness />);

		fireEvent.click(screen.getByText('open'));

		expect(open).toHaveBeenCalled();
	});

	it('prefers the language map over the server-resolved string', () => {
		vi.spyOn(window, 'open').mockImplementation(() => null);
		renderWithTenant({
			content: {
				impressum: '<p>alt</p>',
				impressumLanguages: { de: '<p>neu</p>' }
			}
		});

		fireEvent.click(screen.getByText('open'));

		expect(screen.getByText('neu')).toBeTruthy();
		expect(screen.queryByText('alt')).toBeNull();
	});
});
