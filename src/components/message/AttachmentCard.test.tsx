// @vitest-environment jsdom
/**
 * #994 — one card definition for every attachment state. These tests pin the
 * things that made the old card look unfinished: inline styles, a link that
 * read as plain text, and a file name that pushed the bubble out of shape.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AttachmentCard } from './AttachmentCard';

afterEach(() => cleanup());

const baseProps = {
	fileName: 'report.pdf',
	meta: 'PDF | 1.20 MB',
	actionLabel: 'report.pdf herunterladen'
};

describe('AttachmentCard', () => {
	it('renders a real download link carrying the original file name', () => {
		render(
			<AttachmentCard
				{...baseProps}
				action={{
					kind: 'download',
					href: 'https://api.test/media/1',
					fileName: 'report.pdf'
				}}
			/>
		);

		const link = screen.getByRole('link', {
			name: 'report.pdf herunterladen'
		});
		expect(link.getAttribute('href')).toBe('https://api.test/media/1');
		expect(link.getAttribute('download')).toBe('report.pdf');
	});

	it('carries no inline style attribute — the design lives in SCSS', () => {
		const { container } = render(
			<AttachmentCard
				{...baseProps}
				action={{
					kind: 'download',
					href: 'https://api.test/media/1',
					fileName: 'report.pdf'
				}}
			/>
		);

		expect(
			container.querySelector('.attachmentCard')?.getAttribute('style')
		).toBeNull();
	});

	it('keeps the full name reachable when it is truncated', () => {
		const longName = `${'sehr-langer-dateiname-'.repeat(4)}.pdf`;
		render(
			<AttachmentCard
				{...baseProps}
				fileName={longName}
				action={{
					kind: 'download',
					href: 'https://api.test/media/1',
					fileName: longName
				}}
			/>
		);

		expect(screen.getByText(longName).getAttribute('title')).toBe(longName);
	});

	it('offers the encrypted state as an action, not as a download', () => {
		const onUnlock = vi.fn();
		render(
			<AttachmentCard
				{...baseProps}
				action={{ kind: 'unlock', onUnlock }}
			/>
		);

		expect(screen.queryByRole('link')).toBeNull();
		fireEvent.click(screen.getByRole('button'));
		expect(onUnlock).toHaveBeenCalledTimes(1);
	});

	it('disables the card while it is decrypting', () => {
		render(
			<AttachmentCard
				{...baseProps}
				action={{ kind: 'unlock', onUnlock: vi.fn(), busy: true }}
			/>
		);

		expect(screen.getByRole('button')).toHaveProperty('disabled', true);
	});

	it('never links or activates blocked media', () => {
		render(
			<AttachmentCard {...baseProps} action={{ kind: 'none' }} blocked />
		);

		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	});
});
