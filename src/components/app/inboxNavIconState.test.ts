import { describe, expect, it } from 'vite-plus/test';
import {
	getInboxNavIconLabel,
	pickInboxNavIconState
} from './inboxNavIconState';

const pick = (totalCount: number, unopenedCount: number, overdue = false) =>
	pickInboxNavIconState({ totalCount, unopenedCount, overdue });

describe('pickInboxNavIconState', () => {
	it.each([
		[0, 0, 'empty', null],
		[3, 0, 'allOpened', null],
		[1, 1, 'oneNew', null],
		[2, 2, 'manyNew', { digit: 2 }],
		[9, 9, 'manyNew', { digit: 9 }],
		[10, 10, 'manyNew', 'star'],
		[250, 250, 'manyNew', 'star']
	])('total %i / unopened %i -> %s', (total, unopened, icon, circle) => {
		const state = pick(total, unopened);
		expect(state.icon).toBe(icon);
		expect(state.circle).toEqual(circle);
		expect(state.unopenedCount).toBe(unopened);
	});

	it('shows the overdue icon with the circle only when something is unopened', () => {
		expect(pick(4, 0, true)).toMatchObject({
			icon: 'overdue',
			circle: null
		});
		expect(pick(4, 1, true)).toMatchObject({
			icon: 'overdue',
			circle: { digit: 1 }
		});
		expect(pick(12, 9, true).circle).toEqual({ digit: 9 });
		expect(pick(12, 10, true).circle).toBe('star');
		expect(pick(40, 25, true).circle).toBe('star');
	});

	it('lets overdue win over every other state', () => {
		expect(pick(0, 0, true).icon).toBe('overdue');
	});

	it('treats invalid counts as zero and never lets unopened exceed total', () => {
		expect(pick(-1, -5).icon).toBe('empty');
		expect(pick(Number.NaN, Number.NaN).icon).toBe('empty');
		expect(pick(2.9, 1.2)).toMatchObject({ icon: 'oneNew' });
		expect(pick(3, 7).unopenedCount).toBe(3);
	});
});

describe('getInboxNavIconLabel', () => {
	it.each([
		[pick(0, 0), 'navigation.consultant.inboxState.empty', undefined],
		[pick(5, 0), 'navigation.consultant.inboxState.allOpened', undefined],
		[pick(5, 1), 'navigation.consultant.inboxState.unopened', { count: 1 }],
		[
			pick(30, 14),
			'navigation.consultant.inboxState.unopened',
			{ count: 14 }
		],
		[
			pick(5, 0, true),
			'navigation.consultant.inboxState.overdue',
			undefined
		],
		[
			pick(30, 14, true),
			'navigation.consultant.inboxState.overdueUnopened',
			{ count: 14 }
		]
	])('maps state to key and exact count', (state, key, options) => {
		expect(getInboxNavIconLabel(state)).toEqual({ key, options });
	});
});
