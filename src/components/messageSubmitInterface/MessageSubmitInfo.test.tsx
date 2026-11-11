// @vitest-environment oriso-jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { MessageSubmitInfo } from './MessageSubmitInfo';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../resources/img/icons/i.svg', () => ({
	ReactComponent: (p: any) => <svg data-testid="info-icon" {...p} />
}));

describe('MessageSubmitInfo (#1210: composer notice as an M3 info card)', () => {
	afterEach(cleanup);

	it('renders an info notice as a polite status card', () => {
		render(
			<MessageSubmitInfo
				isInfo
				infoHeadline="shazia ka ist abwesend"
				infoMessage={<>I am out of office</>}
			/>
		);
		const card = screen.getByRole('status');
		expect(card.className).toContain('messageSubmitInfoWrapper');
		expect(card.className).toContain('messageSubmitInfoWrapper--info');
		expect(card.getAttribute('aria-live')).toBe('polite');
		expect(screen.getByText('shazia ka ist abwesend')).toBeTruthy();
		expect(screen.getByText('I am out of office')).toBeTruthy();
		// The icon is decorative; the headline carries the meaning.
		expect(
			screen.getByTestId('info-icon').getAttribute('aria-hidden')
		).toBe('true');
	});

	it('renders an error notice as a dismissable error snackbar', () => {
		const onClose = vi.fn();
		render(
			<MessageSubmitInfo
				isInfo={false}
				infoHeadline="Upload failed"
				infoMessage={<>Try again</>}
				onClose={onClose}
				closeLabel="Close"
			/>
		);
		const snackbar = screen.getByRole('alert');
		expect(snackbar.textContent).toContain('Upload failed');
		expect(snackbar.textContent).toContain('Try again');
		// Not the old magenta card any more.
		expect(document.querySelector('.messageSubmitInfoWrapper')).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('renders the message alone when there is no headline', () => {
		render(<MessageSubmitInfo isInfo infoMessage={<>Only text</>} />);
		expect(screen.getByRole('status').textContent).toContain('Only text');
		// The card keeps its (decorative) icon even without a headline.
		expect(screen.getByTestId('info-icon')).toBeTruthy();
		expect(screen.queryByText(/ist abwesend/)).toBeNull();
	});
});
