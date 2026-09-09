// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { HistoricalReassignMessage } from './ReassignMessage';

vi.mock('../../globalState', async () => {
	const { createContext } = await import('react');
	return { ConsultantListContext: createContext({ consultantList: [] }) };
});
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
afterEach(cleanup);

describe('historical reassignment aliases', () => {
	it.each(['REQUESTED', 'CONFIRMED', 'REJECTED'])(
		'keeps %s readable without retired assignment actions',
		(status) => {
			const message = JSON.stringify({
				status,
				fromConsultantName: 'Karina',
				toConsultantName: 'Kim',
				toAskerName: 'Alpaka',
				fromConsultantId: 'c1',
				toConsultantId: 'c2'
			});
			const { container } = render(
				<HistoricalReassignMessage
					message={message}
					isAsker
					isMySession={false}
				/>
			);
			expect(
				container.querySelector('.reassignRequestMessage')
			).not.toBeNull();
			expect(container.textContent).not.toContain('toConsultantId');
			expect(screen.queryAllByRole('button')).toHaveLength(0);
		}
	);
	it.each(['{bad json', 'null', '{"status":"UNKNOWN"}'])(
		'does not expose an unreadable payload: %s',
		(message) => {
			const { container } = render(
				<HistoricalReassignMessage
					message={message}
					isAsker
					isMySession={false}
				/>
			);
			expect(container.textContent).toBe('');
		}
	);
});
