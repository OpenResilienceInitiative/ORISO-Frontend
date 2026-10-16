// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryAskCard } from './HistoryAskCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

const openDialog = () =>
	fireEvent.click(screen.getByTestId('history-ask-open'));

describe('HistoryAskCard', () => {
	it('cannot send without a text', () => {
		render(<HistoryAskCard roomId="!r" send={vi.fn()} />);
		openDialog();
		expect(
			(screen.getByTestId('history-ask-send') as HTMLButtonElement)
				.disabled
		).toBe(true);
		fireEvent.change(screen.getByRole('textbox'), {
			target: { value: '   ' }
		});
		expect(
			(screen.getByTestId('history-ask-send') as HTMLButtonElement)
				.disabled
		).toBe(true);
	});

	it('sends the trimmed text for this room and then waits', async () => {
		const send = vi.fn().mockResolvedValue(true);
		render(<HistoryAskCard roomId="!room:x" send={send} />);
		openDialog();
		fireEvent.change(screen.getByRole('textbox'), {
			target: { value: '  about my school  ' }
		});
		fireEvent.click(screen.getByTestId('history-ask-send'));

		await waitFor(() =>
			expect(screen.getByText('historyRequest.ask.waiting')).toBeTruthy()
		);
		expect(send).toHaveBeenCalledWith('!room:x', 'about my school');
		expect(screen.queryByTestId('history-ask-send')).toBeNull();
	});

	it('keeps the dialog and the text when sending fails', async () => {
		const send = vi.fn().mockResolvedValue(false);
		render(<HistoryAskCard roomId="!r" send={send} />);
		openDialog();
		fireEvent.change(screen.getByRole('textbox'), {
			target: { value: 'hello' }
		});
		fireEvent.click(screen.getByTestId('history-ask-send'));

		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
			'hello'
		);
	});

	it('says so when the keys arrive for this room', async () => {
		render(
			<HistoryAskCard roomId="!r" send={vi.fn()} initialState="waiting" />
		);
		window.dispatchEvent(
			new CustomEvent('oriso:matrix-history-keys-imported', {
				detail: { roomId: '!r', imported: 3 }
			})
		);
		await waitFor(() =>
			expect(screen.getByText('historyRequest.ask.done')).toBeTruthy()
		);
	});
});
