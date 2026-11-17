// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { AskerCallInfo, AskerCallInfoDialog } from './AskerCallInfoDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

afterEach(cleanup);

describe('AskerCallInfoDialog', () => {
	it('says that the counsellor starts calls', () => {
		render(
			<AskerCallInfoDialog
				open
				onClose={vi.fn()}
				state={{ status: 'none' }}
			/>
		);
		expect(screen.getByText('videoCall.askerInfo.title')).toBeTruthy();
		expect(
			screen.getByText('videoCall.askerInfo.description')
		).toBeTruthy();
	});

	it('shows date, time and medium of the next appointment', () => {
		render(
			<AskerCallInfoDialog
				open
				onClose={vi.fn()}
				state={{
					status: 'appointment',
					start: new Date(2026, 10, 19, 15, 0),
					end: new Date(2026, 10, 19, 16, 0),
					medium: 'phone'
				}}
			/>
		);
		const card = screen.getByTestId('asker-call-info-appointment');
		expect(card.textContent).toContain('videoCall.askerInfo.next');
		expect(card.textContent).toContain('videoCall.askerInfo.medium.phone');
		expect(card.textContent).toContain('19.');
		expect(card.textContent).toContain('15:00');
		expect(card.textContent).toContain('16:00');
		expect(screen.queryByTestId('asker-call-info-request')).toBeNull();
	});

	it('offers to ask for a time when none is set up', () => {
		const onRequestTime = vi.fn();
		render(
			<AskerCallInfoDialog
				open
				onClose={vi.fn()}
				state={{ status: 'none' }}
				onRequestTime={onRequestTime}
			/>
		);
		expect(screen.getByText('videoCall.askerInfo.none')).toBeTruthy();
		fireEvent.click(screen.getByTestId('asker-call-info-request'));
		expect(onRequestTime).toHaveBeenCalledTimes(1);
	});

	it('names loading and a failed read instead of claiming no appointment', () => {
		const { rerender } = render(
			<AskerCallInfoDialog
				open
				onClose={vi.fn()}
				state={{ status: 'loading' }}
			/>
		);
		expect(screen.getByText('videoCall.askerInfo.loading')).toBeTruthy();
		expect(screen.queryByText('videoCall.askerInfo.none')).toBeNull();
		rerender(
			<AskerCallInfoDialog
				open
				onClose={vi.fn()}
				state={{ status: 'error' }}
			/>
		);
		expect(screen.getByText('videoCall.askerInfo.error')).toBeTruthy();
		expect(screen.queryByText('videoCall.askerInfo.none')).toBeNull();
	});
});

describe('AskerCallInfo', () => {
	it('reads the conversation appointments when it opens', async () => {
		const load = vi.fn().mockResolvedValue([
			{
				id: 'a',
				sessionId: 7,
				startTime: new Date(Date.now() + 86_400_000).toISOString(),
				endTime: new Date(Date.now() + 90_000_000).toISOString(),
				status: 'SCHEDULED',
				kind: 'VIDEO'
			}
		]);
		render(
			<AskerCallInfo sessionId={7} open onClose={vi.fn()} load={load} />
		);
		expect(load).toHaveBeenCalledWith(7);
		await waitFor(() =>
			expect(
				screen.getByTestId('asker-call-info-appointment').textContent
			).toContain('videoCall.askerInfo.medium.video')
		);
	});

	it('does not read anything while closed', () => {
		const load = vi.fn().mockResolvedValue([]);
		render(
			<AskerCallInfo
				sessionId={7}
				open={false}
				onClose={vi.fn()}
				load={load}
			/>
		);
		expect(load).not.toHaveBeenCalled();
	});

	it('shows the error state when the read fails', async () => {
		const load = vi.fn().mockRejectedValue(new Error('down'));
		render(
			<AskerCallInfo sessionId={7} open onClose={vi.fn()} load={load} />
		);
		await waitFor(() =>
			expect(screen.getByText('videoCall.askerInfo.error')).toBeTruthy()
		);
	});
});
