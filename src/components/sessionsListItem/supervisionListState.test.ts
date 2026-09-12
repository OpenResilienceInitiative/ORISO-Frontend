import { describe, expect, it } from 'vitest';
import {
	getSupervisionListState,
	getSupervisorDisplayNames,
	isActiveSupervisorOf
} from './supervisionListState';

const ME = 'consultant-me';
const OTHER = 'consultant-other';

const session = (supervision?: any, consultantId = OTHER) => ({
	item: supervision === undefined ? { id: 1 } : { id: 1, supervision },
	consultant: { id: consultantId }
});

describe('getSupervisionListState', () => {
	it('returns none when the backend does not send the marker', () => {
		expect(getSupervisionListState(session(undefined), ME)).toBe('none');
	});

	it('returns none for a null/empty session or missing user', () => {
		expect(getSupervisionListState(null, ME)).toBe('none');
		expect(getSupervisionListState({ item: null }, ME)).toBe('none');
		expect(
			getSupervisionListState(
				session({
					supervisedByMe: true,
					supervisorConsultantIds: [ME],
					supervisorDisplayNames: ['Me']
				}),
				undefined
			)
		).toBe('none');
	});

	it('returns supervisedByMe when the marker says so', () => {
		expect(
			getSupervisionListState(
				session({
					supervisedByMe: true,
					supervisorConsultantIds: [ME],
					supervisorDisplayNames: ['Me']
				}),
				ME
			)
		).toBe('supervisedByMe');
	});

	it('trusts the id list when supervisedByMe is missing but my id is listed', () => {
		expect(
			getSupervisionListState(
				session({
					supervisorConsultantIds: [OTHER, ME],
					supervisorDisplayNames: ['Other', 'Me']
				}),
				ME
			)
		).toBe('supervisedByMe');
	});

	it('returns supervisedByOthers when supervisors exist and I am not one', () => {
		expect(
			getSupervisionListState(
				session(
					{
						supervisedByMe: false,
						supervisorConsultantIds: ['supervisor-1'],
						supervisorDisplayNames: ['Sabine Supervisor']
					},
					ME
				),
				ME
			)
		).toBe('supervisedByOthers');
	});

	it('returns none when the marker is present but empty', () => {
		expect(
			getSupervisionListState(
				session({
					supervisedByMe: false,
					supervisorConsultantIds: [],
					supervisorDisplayNames: []
				}),
				ME
			)
		).toBe('none');
	});

	it('compares ids as strings', () => {
		expect(
			getSupervisionListState(
				session({
					supervisedByMe: false,
					supervisorConsultantIds: [42 as any],
					supervisorDisplayNames: ['Answer']
				}),
				'42'
			)
		).toBe('supervisedByMe');
	});
});

describe('isActiveSupervisorOf', () => {
	it('is a boolean view of supervisedByMe', () => {
		expect(
			isActiveSupervisorOf(
				session({
					supervisedByMe: true,
					supervisorConsultantIds: [ME],
					supervisorDisplayNames: []
				}),
				ME
			)
		).toBe(true);
		expect(isActiveSupervisorOf(session(undefined), ME)).toBe(false);
	});
});

describe('getSupervisorDisplayNames', () => {
	it('returns the display names, falling back to ids for missing names', () => {
		expect(
			getSupervisorDisplayNames(
				session({
					supervisedByMe: false,
					supervisorConsultantIds: ['s1', 's2'],
					supervisorDisplayNames: ['Sabine']
				})
			)
		).toEqual(['Sabine', 's2']);
	});

	it('returns an empty list without a marker', () => {
		expect(getSupervisorDisplayNames(session(undefined))).toEqual([]);
		expect(getSupervisorDisplayNames(null)).toEqual([]);
	});
});
