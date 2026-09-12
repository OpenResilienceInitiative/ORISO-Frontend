import { describe, expect, it } from 'vitest';
import {
	filterEligibleSupervisorConsultants,
	resolveSupervisorDirectoryAgencyId
} from './supervisorDirectory';

describe('supervisor directory', () => {
	it('uses the case agency when stale session metadata names another agency', () => {
		expect(
			resolveSupervisorDirectoryAgencyId({
				sessionAgencyId: 42,
				metadataAgencyId: 99
			})
		).toBe('42');
	});

	it('offers only eligible colleagues who are not already supervising the case', () => {
		const consultants = [
			{ consultantId: 'eligible', isSupervisor: true },
			{ consultantId: 'ordinary', isSupervisor: false },
			{ consultantId: 'self', isSupervisor: true },
			{ consultantId: 'already-added', isSupervisor: true },
			{ consultantId: 'eligible', isSupervisor: true }
		];

		expect(
			filterEligibleSupervisorConsultants({
				consultants,
				currentConsultantId: 'self',
				currentSupervisorIds: ['already-added']
			})
		).toEqual([{ consultantId: 'eligible', isSupervisor: true }]);
	});
});
