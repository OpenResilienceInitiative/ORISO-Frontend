import { beforeEach, describe, expect, it } from 'vitest';
import { sessionKindRegistry } from './sessionKindRegistry';

describe('sessionKindRegistry (#1377 sound mask)', () => {
	beforeEach(() => sessionKindRegistry.reset());

	it('remembers the classified kind per session id and section', () => {
		sessionKindRegistry.publish('sessions', { '12': 'oneToOne', '13': 'circle' });
		sessionKindRegistry.publish('requests', { '99': 'liveChat' });
		expect(sessionKindRegistry.lookup('12')).toEqual({ section: 'sessions', kind: 'oneToOne' });
		expect(sessionKindRegistry.lookup(99)).toEqual({ section: 'requests', kind: 'liveChat' });
		expect(sessionKindRegistry.lookup('nope')).toBeNull();
	});

	it('replaces a section wholesale on the next publish', () => {
		sessionKindRegistry.publish('sessions', { '12': 'oneToOne' });
		sessionKindRegistry.publish('sessions', { '13': 'circle' });
		expect(sessionKindRegistry.lookup('12')).toBeNull();
		expect(sessionKindRegistry.lookup('13')?.kind).toBe('circle');
	});
});
