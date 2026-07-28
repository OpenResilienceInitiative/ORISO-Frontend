import { describe, expect, it } from 'vitest';

import { isAllowedWidgetCapability } from './orisoWidgetCapabilities';

const allowed = (capability: string) =>
	isAllowedWidgetCapability(capability, '@a:hs', 'ORISO_WEB_test');

describe('isAllowedWidgetCapability', () => {
	it('grants the call membership state events Element Call needs to join', () => {
		expect(
			allowed(
				'org.matrix.msc2762.send.state_event:org.matrix.msc3401.call.member#@a:hs_DEVICE_m.call'
			)
		).toBe(false);
		expect(
			allowed(
				'org.matrix.msc2762.send.state_event:org.matrix.msc3401.call.member#@a:hs_ORISO_WEB_test_m.call'
			)
		).toBe(true);
		expect(
			allowed(
				'org.matrix.msc2762.receive.state_event:org.matrix.msc3401.call.member'
			)
		).toBe(true);
	});

	it('grants encrypted to-device traffic, which is how media keys travel', () => {
		expect(
			allowed(
				'org.matrix.msc3819.send.to_device:io.element.call.encryption_keys'
			)
		).toBe(true);
		expect(
			allowed(
				'org.matrix.msc3819.receive.to_device:io.element.call.encryption_keys'
			)
		).toBe(true);
	});

	it('refuses to let the call widget post chat messages as the user', () => {
		// The whole point of the allow-list: an iframe that could send
		// `m.room.message` could write into a counselling session under the
		// counsellor's name.
		expect(allowed('org.matrix.msc2762.send.event:m.room.message')).toBe(
			false
		);
		expect(allowed('org.matrix.msc2762.receive.event:m.room.message')).toBe(
			false
		);
	});

	it('lets the room-confined widget read the state required to boot', () => {
		for (const type of [
			'm.room.create',
			'm.room.name',
			'm.room.member',
			'm.room.encryption'
		]) {
			expect(
				allowed(`org.matrix.msc2762.receive.state_event:${type}`)
			).toBe(true);
		}
	});

	it('does not let the widget write another device membership', () => {
		expect(
			allowed(
				'org.matrix.msc2762.send.state_event:org.matrix.msc3401.call.member#@a:hs_DEVICE_m.call'
			)
		).toBe(false);
	});

	it('refuses to let the call widget change who may enter a room', () => {
		expect(
			allowed('org.matrix.msc2762.send.state_event:m.room.power_levels#')
		).toBe(false);
		expect(
			allowed('org.matrix.msc2762.send.state_event:m.room.join_rules#')
		).toBe(false);
	});

	it('does not confuse a state key for an event type', () => {
		// Everything after `#` is the state key. A widget must not be able to
		// smuggle an allowed type in there.
		expect(
			allowed(
				'org.matrix.msc2762.send.state_event:m.room.power_levels#org.matrix.msc3401.call.member'
			)
		).toBe(false);
	});

	it('denies anything it does not recognise', () => {
		expect(allowed('m.send.event')).toBe(false);
		expect(allowed('')).toBe(false);
		expect(allowed('org.matrix.msc2762.send.event:')).toBe(false);
	});

	it('grants delayed membership maintenance but no broad plain capability', () => {
		expect(allowed('org.matrix.msc4157.send.delayed_event')).toBe(true);
		expect(allowed('m.always_on_screen')).toBe(false);
		expect(allowed('org.matrix.msc2931.navigate')).toBe(false);
	});

	it('rejects the former broad signalling and redaction surface', () => {
		for (const capability of [
			'org.matrix.msc2762.send.event:m.room.redaction',
			'org.matrix.msc3819.send.to_device:m.call.invite',
			'org.matrix.msc3819.send.to_device:m.call.hangup'
		]) {
			expect(allowed(capability)).toBe(false);
		}
	});
});
