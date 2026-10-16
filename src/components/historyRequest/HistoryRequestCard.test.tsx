// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryRequestCard } from './HistoryRequestCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

describe('HistoryRequestCard', () => {
	it('shows what the person wrote, as plain text', () => {
		render(
			<HistoryRequestCard
				reason="<b>It was about my school</b>"
				onApprove={vi.fn()}
				onDecline={vi.fn()}
			/>
		);

		expect(screen.getByText('<b>It was about my school</b>')).toBeTruthy();
		expect(document.querySelector('b')).toBeNull();
	});

	it('is a named region with the two decisions', () => {
		render(
			<HistoryRequestCard
				reason="x"
				onApprove={vi.fn()}
				onDecline={vi.fn()}
			/>
		);

		expect(
			screen.getByRole('region', { name: 'historyRequest.card.title' })
		).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'historyRequest.card.approve' })
		).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'historyRequest.card.decline' })
		).toBeTruthy();
	});

	it('reports approve and decline', () => {
		const onApprove = vi.fn();
		const onDecline = vi.fn();
		render(
			<HistoryRequestCard
				reason="x"
				onApprove={onApprove}
				onDecline={onDecline}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'historyRequest.card.approve' })
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'historyRequest.card.decline' })
		);

		expect(onApprove).toHaveBeenCalledTimes(1);
		expect(onDecline).toHaveBeenCalledTimes(1);
	});

	it('blocks both decisions while a release is running', () => {
		render(
			<HistoryRequestCard
				reason="x"
				busy
				onApprove={vi.fn()}
				onDecline={vi.fn()}
			/>
		);

		for (const name of ['approve', 'decline']) {
			expect(
				(
					screen.getByRole('button', {
						name: `historyRequest.card.${name}`
					}) as HTMLButtonElement
				).disabled
			).toBe(true);
		}
	});

	it('announces a failed release', () => {
		render(
			<HistoryRequestCard
				reason="x"
				failed
				onApprove={vi.fn()}
				onDecline={vi.fn()}
			/>
		);

		expect(screen.getByRole('alert').textContent).toBe(
			'historyRequest.card.failed'
		);
	});
});
