// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { useLegalLinkDialog } from './useLegalLinkDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => `t:${key}` })
}));

const Harness = ({ rawLabel }: { rawLabel: string }) => {
	const { openLegalLink, dialog } = useLegalLinkDialog();
	return (
		<>
			<button
				type="button"
				onClick={() =>
					openLegalLink(
						'Impressum',
						'https://example.invalid/imprint',
						rawLabel
					)
				}
			>
				open
			</button>
			{dialog}
		</>
	);
};

describe('useLegalLinkDialog', () => {
	beforeEach(() => {
		// This repo has no global auto-cleanup, so a previous render's tree
		// would still be in the document and every query would match twice.
		cleanup();
		vi.restoreAllMocks();
	});

	it('opens the platform note instead of a new tab', () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		render(<Harness rawLabel="login.legal.infoText.impressum" />);

		fireEvent.click(screen.getByText('open'));

		expect(open).not.toHaveBeenCalled();
		expect(
			screen.getByText('t:login.legal.platform.impressum')
		).toBeTruthy();
	});

	it('keeps the full text reachable in a new tab', () => {
		vi.spyOn(window, 'open').mockImplementation(() => null);
		render(<Harness rawLabel="login.legal.infoText.dataprotection" />);

		fireEvent.click(screen.getByText('open'));

		const link = screen.getByText('t:login.legal.platform.fullText')
			.closest('a') as HTMLAnchorElement;
		expect(link.href).toBe('https://example.invalid/imprint');
		expect(link.target).toBe('_blank');
		expect(link.rel).toContain('noopener');
	});

	it('opens the page directly for an entry with no platform note', () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		render(<Harness rawLabel="login.legal.infoText.termsAndConditions" />);

		fireEvent.click(screen.getByText('open'));

		expect(open).toHaveBeenCalledWith(
			'https://example.invalid/imprint',
			'_blank',
			'noopener'
		);
	});
});
