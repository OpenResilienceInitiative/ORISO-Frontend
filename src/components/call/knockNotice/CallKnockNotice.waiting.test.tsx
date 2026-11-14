// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { KnockingPerson } from './callKnockModel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values
				? `${key}(${Object.entries(values)
						.map(([name, value]) => `${name}=${value}`)
						.join(',')})`
				: key
	})
}));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('../../../hooks/usePrefersReducedMotion', () => ({
	usePrefersReducedMotion: () => motion.reduced
}));

const { CallKnockNotice } = await import('./CallKnockNotice');

afterEach(() => {
	cleanup();
	motion.reduced = false;
});

const NOW = Date.parse('2026-11-12T20:10:00Z');

const person = (
	id: number,
	requestedAt: string,
	avatarId: string | null = 'magpie'
): KnockingPerson => ({
	id,
	name: `person-${id}`,
	medium: 'VIDEO',
	requestedAt,
	avatarId
});

const renderNotice = (
	people: KnockingPerson[],
	onNudge = vi.fn(),
	nowMs = NOW
) => {
	const view = render(
		<CallKnockNotice
			people={people}
			nowMs={nowMs}
			onNudge={onNudge}
			onAdmit={vi.fn()}
			onDecline={vi.fn()}
			onAdmitAll={vi.fn()}
		/>
	);
	return { ...view, onNudge };
};

/* Frank, 2026-11-12: the host sees the person's picture and how long they
   have been waiting; after a minute "Einlassen" wiggles and a soft knock
   sounds, once. */
describe('CallKnockNotice — who waits and for how long (#2237)', () => {
	it('shows the picture the person chose', () => {
		renderNotice([person(1, '2026-11-12T20:09:30Z')]);
		expect(screen.getByTestId('call-knock-avatar')).toBeTruthy();
	});

	it('says how long the person has been waiting', () => {
		renderNotice([person(1, '2026-11-12T20:07:00Z')]);
		expect(screen.getByTestId('call-knock-waiting').textContent).toBe(
			'calls.knock.waitingFor(count=3)'
		);
	});

	it('says somebody just arrived in their first minute, without a nudge', () => {
		const { onNudge } = renderNotice([person(1, '2026-11-12T20:09:30Z')]);
		expect(screen.getByTestId('call-knock-waiting').textContent).toBe(
			'calls.knock.justArrived'
		);
		expect(
			screen.getByTestId('call-knock-admit').dataset.nudge
		).toBeUndefined();
		expect(onNudge).not.toHaveBeenCalled();
	});

	it('nudges once after a minute: "Einlassen" wiggles and a knock sounds', () => {
		const { onNudge, rerender } = renderNotice([
			person(1, '2026-11-12T20:08:30Z')
		]);
		expect(screen.getByTestId('call-knock-admit').dataset.nudge).toBe(
			'true'
		);
		expect(onNudge).toHaveBeenCalledTimes(1);
		rerender(
			<CallKnockNotice
				people={[person(1, '2026-11-12T20:08:30Z')]}
				nowMs={NOW + 30_000}
				onNudge={onNudge}
				onAdmit={vi.fn()}
				onDecline={vi.fn()}
				onAdmitAll={vi.fn()}
			/>
		);
		expect(onNudge).toHaveBeenCalledTimes(1);
	});

	it('knocks but does not wiggle when the person asked for less motion', () => {
		motion.reduced = true;
		const { onNudge } = renderNotice([person(1, '2026-11-12T20:08:30Z')]);
		expect(
			screen.getByTestId('call-knock-admit').dataset.nudge
		).toBeUndefined();
		expect(onNudge).toHaveBeenCalledTimes(1);
	});

	it('keeps the old line when the server sent no time', () => {
		renderNotice([{ id: 1, name: 'x', medium: 'AUDIO' }]);
		expect(screen.getByTestId('call-knock-waiting').textContent).toBe(
			'calls.knock.wantsIn'
		);
	});
});
