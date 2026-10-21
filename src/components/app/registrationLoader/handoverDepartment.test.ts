// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test';
import {
	forgetHandoverDepartment,
	readHandoverDepartment,
	readHandoverGroupJoin,
	rememberHandoverDepartment,
	rememberHandoverGroupJoin,
	toHandoverDepartment
} from './handoverDepartment';

describe('handoverDepartment', () => {
	beforeEach(() => sessionStorage.clear());

	it('carries the chosen department across the document load', () => {
		rememberHandoverDepartment({ agencyId: 19, topicId: 17 });
		expect(readHandoverDepartment()).toEqual({ agencyId: 19, topicId: 17 });
	});

	it('is null when nothing was chosen, so the platform documents open', () => {
		rememberHandoverDepartment(null);
		expect(readHandoverDepartment()).toBeNull();
	});

	it('ignores anything that is not a department', () => {
		sessionStorage.setItem('handover-department', '{"agencyId":"x"}');
		expect(readHandoverDepartment()).toBeNull();
		sessionStorage.setItem('handover-department', 'not json');
		expect(readHandoverDepartment()).toBeNull();
	});

	it('is forgotten once the person is in', () => {
		rememberHandoverDepartment({ agencyId: 19, topicId: 17 });
		forgetHandoverDepartment();
		expect(readHandoverDepartment()).toBeNull();
	});

	it('derives the department from the topic, else the main topic', () => {
		expect(
			toHandoverDepartment({
				agency: { id: '19' },
				mainTopic: { id: 3 },
				topic: { id: 17 }
			})
		).toEqual({ agencyId: 19, topicId: 17 });
		expect(
			toHandoverDepartment({ agency: { id: 19 }, mainTopic: { id: 3 } })
		).toEqual({ agencyId: 19, topicId: 3 });
		expect(toHandoverDepartment({ mainTopic: { id: 3 } })).toBeNull();
		expect(toHandoverDepartment({ agency: { id: 19 } })).toBeNull();
	});

	it('carries the group decision across the document load', () => {
		expect(readHandoverGroupJoin()).toBeNull();
		rememberHandoverGroupJoin(false);
		expect(readHandoverGroupJoin()).toBe(false);
		rememberHandoverGroupJoin(true);
		expect(readHandoverGroupJoin()).toBe(true);
		forgetHandoverDepartment();
		expect(readHandoverGroupJoin()).toBeNull();
	});
});
