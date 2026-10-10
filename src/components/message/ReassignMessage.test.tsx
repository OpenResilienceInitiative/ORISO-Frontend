// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { HistoricalReassignMessage } from './ReassignMessage';
import { ConsultantListContext } from '../../globalState';

vi.mock('../../globalState', async () => {
	const { createContext } = await import('react');
	return { ConsultantListContext: createContext({ consultantList: [] }) };
});
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string>) =>
			options ? `${key} ${JSON.stringify(options)}` : key
	})
}));
afterEach(cleanup);

const payload = (overrides: Record<string, string> = {}) =>
	JSON.stringify({
		status: 'REQUESTED',
		fromConsultantName: 'Karina',
		toConsultantName: 'Kim',
		toAskerName: 'Alpaka',
		fromConsultantId: 'c1',
		toConsultantId: 'c2',
		...overrides
	});

describe('HistoricalReassignMessage', () => {
	it.each([
		['REQUESTED', true],
		['REQUESTED', false],
		['CONFIRMED', true],
		['CONFIRMED', false],
		['REJECTED', true],
		['REJECTED', false]
	])('keeps %s readable without actions (asker: %s)', (status, isAsker) => {
		const { container } = render(
			<HistoricalReassignMessage
				message={payload({ status })}
				isAsker={isAsker}
				isMySession={false}
			/>
		);
		expect(
			container.querySelector('.reassignRequestMessage')
		).not.toBeNull();
		expect(screen.queryAllByRole('button')).toHaveLength(0);
	});

	it('labels a historical record with the standard information icon', () => {
		render(
			<HistoricalReassignMessage
				message={payload()}
				isAsker
				isMySession={false}
			/>
		);
		expect(screen.getByLabelText('notifications.info')).not.toBeNull();
	});

	it('no longer asks the advice seeker to accept or decline', () => {
		const { container } = render(
			<HistoricalReassignMessage
				message={payload()}
				isAsker
				isMySession={false}
			/>
		);
		expect(container.textContent).not.toContain(
			'session.reassign.system.message.reassign.question'
		);
		expect(container.textContent).not.toContain(
			'session.reassign.system.message.reassign.accept'
		);
	});

	// An open request can no longer be answered; the old copy claimed access
	// had moved (asker) or would move on consent (staff).
	it.each([true, false])(
		'describes an unanswered request as historical (asker: %s)',
		(isAsker) => {
			const { container } = render(
				<HistoricalReassignMessage
					message={payload()}
					isAsker={isAsker}
					isMySession={false}
				/>
			);
			expect(container.textContent).toContain(
				'session.reassign.system.message.reassign.historical'
			);
			expect(container.textContent).not.toContain(
				'session.reassign.system.message.reassign.description.noTeam'
			);
			expect(container.textContent).not.toContain(
				'session.reassign.system.message.reassign.sent.description.noTeam'
			);
		}
	);

	it('names a blank counsellor as a former counsellor', () => {
		const { container } = render(
			<HistoricalReassignMessage
				message={payload({
					status: 'CONFIRMED',
					fromConsultantName: '',
					toConsultantName: ''
				})}
				isAsker={false}
				isMySession={false}
			/>
		);
		expect(container.textContent).toContain(
			'"oldConsultant":"caseHandover.history.unknownConsultant"'
		);
		expect(container.textContent).toContain(
			'"newConsultant":"caseHandover.history.unknownConsultant"'
		);
	});

	it.each(['sanftes Alpaka Kim', ''])(
		'never exposes a legal-name lookup to an anonymous guest (stored: %s)',
		(storedName) => {
			const { container } = render(
				<ConsultantListContext.Provider
					value={{
						consultantList: [
							{
								value: 'c2',
								label: 'Karina Legal (karina.private)'
							}
						],
						setConsultantList: () => {}
					}}
				>
					<HistoricalReassignMessage
						message={payload({
							status: 'CONFIRMED',
							toConsultantName: storedName
						})}
						isAsker
						isMySession={false}
					/>
				</ConsultantListContext.Provider>
			);
			expect(container.textContent).toContain(storedName || 'c2');
			expect(container.textContent).not.toContain('Karina Legal');
			expect(container.textContent).not.toContain('karina.private');
		}
	);

	it('uses the User-ID when an advice seeker has no stored display name', () => {
		const { container } = render(
			<HistoricalReassignMessage
				message={payload({ status: 'CONFIRMED', toConsultantName: '' })}
				isAsker
				isMySession={false}
			/>
		);
		expect(container.textContent).toContain('"newConsultant":"c2"');
	});

	it('keeps the stored name when the consultant list cannot resolve it', () => {
		const { container } = render(
			<HistoricalReassignMessage
				message={payload({ status: 'CONFIRMED' })}
				isAsker={false}
				isMySession={false}
			/>
		);
		expect(container.textContent).toContain('"oldConsultant":"Karina"');
		expect(container.textContent).toContain('"newConsultant":"Kim"');
	});

	it.each(['{bad json', 'null', '{"status":"UNKNOWN"}', ''])(
		'renders nothing for an unreadable payload: %s',
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
