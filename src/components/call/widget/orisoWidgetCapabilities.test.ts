import { describe, expect, it } from 'vitest';

import { isAllowedWidgetCapability } from './orisoWidgetCapabilities';

describe('isAllowedWidgetCapability', () => {
	it('grants the call membership state events Element Call needs to join', () => {
		expect(
			isAllowedWidgetCapability(
				'org.matrix.msc2762.send.state_event:org.matrix.msc3401.call.member#@a:hs_DEVICE_m.call'
			)
		).toBe(true);
		expect(
			isAllowedWidgetCapability(
				'org.matrix.msc2762.receive.state_event:org.matrix.msc3401.call.member'
			)
		).toBe(true);
	});

	it('grants encrypted to-device traffic, which is how media keys travel', () => {
		expect(
			isAllowedWidgetCapability(
				'org.matrix.msc3819.send.to_device:io.element.call.encryption_keys'
			)
		).toBe(true);
		expect(
			isAllowedWidgetCapability(
				'org.matrix.msc3819.receive.to_device:m.call.encryption_keys'
			)
		).toBe(true);
	});

	it('refuses to let the call widget post chat messages as the user', () => {
		// The whole point of the allow-list: an iframe that could send
		// `m.room.message` could write into a counselling session under the
		// counsellor's name.
		expect(
			isAllowedWidgetCapability(
				'org.matrix.msc2762.send.event:m.room.message'
			)
		).toBe(false);
		expect(
			isAllowedWidgetCapability(
				'org.matrix.msc2762.receive.event:m.room.message'
			)
		).toBe(false);
	});

	it('refuses to let the call widget change who may enter a room', () => {
		expect(
			isAllowedWidgetCapability(
				'org.matrix.msc2762.send.state_event:m.room.power_levels#'
			)
		).toBe(false);
		expect(
			isAllowedWidgetCapability(
				'org.matrix.msc2762.send.state_event:m.room.join_rules#'
			)
		).toBe(false);
	});

	it('does not confuse a state key for an event type', () => {
		// Everything after `#` is the state key. A widget must not be able to
		// smuggle an allowed type in there.
		expect(
			isAllowedWidgetCapability(
				'org.matrix.msc2762.send.state_event:m.room.power_levels#org.matrix.msc3401.call.member'
			)
		).toBe(false);
	});

	it('denies anything it does not recognise', () => {
		expect(isAllowedWidgetCapability('m.send.event')).toBe(false);
		expect(isAllowedWidgetCapability('')).toBe(false);
		expect(
			isAllowedWidgetCapability('org.matrix.msc2762.send.event:')
		).toBe(false);
	});

	it('grants the plain capabilities a call needs to stay on screen', () => {
		expect(isAllowedWidgetCapability('m.always_on_screen')).toBe(true);
		expect(
			isAllowedWidgetCapability('org.matrix.msc4157.send.delayed_event')
		).toBe(true);
	});
});
