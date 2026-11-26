import { describe, expect, it } from 'vite-plus/test';
import { withFoldedPracticeProgress } from './practiceFoldedProgress';
import { CASE_HANDOVER_TOUR_VERSION } from '../components/productTour/tours/caseHandoverTour';

type Item = Parameters<typeof withFoldedPracticeProgress>[0][number];

const SUPERVISION = 'consultant-practice-supervision';
const HANDOVER = 'consultant-case-handover';
const item = (
	tourId: string,
	status: Item['status'],
	tourVersion = 1
): Item => ({ tourId, tourVersion, status });

describe('withFoldedPracticeProgress (FE#2545: "Supervisor hinzufügen" is part of "Fälle übergeben")', () => {
	it('reads a completed former Supervision card as a completed "Fälle übergeben" of the current version', () => {
		const old = item(SUPERVISION, 'completed');
		expect(withFoldedPracticeProgress([old])).toEqual([
			old,
			expect.objectContaining({
				tourId: HANDOVER,
				tourVersion: CASE_HANDOVER_TOUR_VERSION,
				status: 'completed'
			})
		]);
	});

	it('replaces a non-terminal current record, and keeps an older version untouched', () => {
		const older = item(HANDOVER, 'completed', 1);
		const current = item(
			HANDOVER,
			'in_progress',
			CASE_HANDOVER_TOUR_VERSION
		);
		const result = withFoldedPracticeProgress([
			item(SUPERVISION, 'completed'),
			older,
			current
		]);
		expect(result).toContainEqual(older);
		expect(
			result.filter(
				(r) =>
					r.tourId === HANDOVER &&
					r.tourVersion === CASE_HANDOVER_TOUR_VERSION
			)
		).toEqual([expect.objectContaining({ status: 'completed' })]);
	});

	it.each(['completed', 'skipped'] as const)(
		'keeps a current "Fälle übergeben" record that is already %s',
		(status) => {
			const items = [
				item(SUPERVISION, 'completed'),
				item(HANDOVER, status, CASE_HANDOVER_TOUR_VERSION)
			];
			expect(withFoldedPracticeProgress(items)).toBe(items);
		}
	);

	it.each(['in_progress', 'skipped', 'not_started'] as const)(
		'changes nothing when the former card was only %s',
		(status) => {
			const items = [item(SUPERVISION, status)];
			expect(withFoldedPracticeProgress(items)).toBe(items);
		}
	);

	it('leaves the list alone without the former card', () => {
		const items = [
			item(HANDOVER, 'in_progress', CASE_HANDOVER_TOUR_VERSION)
		];
		expect(withFoldedPracticeProgress(items)).toBe(items);
		expect(withFoldedPracticeProgress([])).toEqual([]);
	});
});
