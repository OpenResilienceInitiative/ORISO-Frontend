// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	forgetHandoverDepartment,
	readHandoverDepartment,
	rememberHandoverDepartment
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
});
