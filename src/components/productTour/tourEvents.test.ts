import { describe, expect, it, vi } from 'vitest';
import { emitTourEvent, subscribeToTourEvent } from './tourEvents';

describe('tour event bus', () => {
	it('delivers an emitted event to subscribers of that name only', () => {
		const sent = vi.fn();
		const other = vi.fn();
		const offSent = subscribeToTourEvent('practice:message-sent', sent);
		const offOther = subscribeToTourEvent('practice:accepted', other);

		emitTourEvent('practice:message-sent');

		expect(sent).toHaveBeenCalledTimes(1);
		expect(other).not.toHaveBeenCalled();
		offSent();
		offOther();
	});

	it('stops delivering after unsubscribe', () => {
		const handler = vi.fn();
		const off = subscribeToTourEvent('e', handler);

		off();
		emitTourEvent('e');

		expect(handler).not.toHaveBeenCalled();
	});

	it('does not replay an event to a subscriber that arrives later', () => {
		emitTourEvent('early');
		const handler = vi.fn();
		const off = subscribeToTourEvent('early', handler);

		expect(handler).not.toHaveBeenCalled();
		off();
	});

	it('does not crash when a listener unsubscribes another mid-emit', () => {
		let offSecond = () => {};
		const offFirst = subscribeToTourEvent('e', () => offSecond());
		offSecond = subscribeToTourEvent('e', vi.fn());

		expect(() => emitTourEvent('e')).not.toThrow();
		offFirst();
	});

	it('keeps delivering to the others when one handler throws', () => {
		const after = vi.fn();
		const offBad = subscribeToTourEvent('e', () => {
			throw new Error('boom');
		});
		const offGood = subscribeToTourEvent('e', after);

		emitTourEvent('e');

		expect(after).toHaveBeenCalledTimes(1);
		offBad();
		offGood();
	});
});
