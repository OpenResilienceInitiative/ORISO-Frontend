// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageSubmitInfo } from './MessageSubmitInfo';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../resources/img/icons/i.svg', () => ({
	ReactComponent: (p: any) => <svg data-testid="info-icon" {...p} />
}));
vi.mock('../../resources/img/icons/exclamation-mark.svg', () => ({
	ReactComponent: (p: any) => <svg data-testid="error-icon" {...p} />
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

	it('renders an error notice as an alert card', () => {
		render(
			<MessageSubmitInfo
				isInfo={false}
				infoHeadline="Upload failed"
				infoMessage={<>Try again</>}
			/>
		);
		const card = screen.getByRole('alert');
		expect(card.className).toContain('messageSubmitInfoWrapper--error');
		expect(screen.getByTestId('error-icon')).toBeTruthy();
	});

	it('renders the message alone when there is no headline', () => {
		render(<MessageSubmitInfo isInfo infoMessage={<>Only text</>} />);
		expect(screen.getByRole('status').textContent).toContain('Only text');
		// The card keeps its (decorative) icon even without a headline.
		expect(screen.getByTestId('info-icon')).toBeTruthy();
		expect(screen.queryByText(/ist abwesend/)).toBeNull();
	});
});
