import { describe, expect, it } from 'vite-plus/test';

import { isAllowedWidgetCapability } from './orisoWidgetCapabilities';

const allowed = (capability: string) =>
	isAllowedWidgetCapability(
		capability,
		'@a:hs',
		'ORISO_WEB_test',
		'!call:hs'
	);

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

	it('grants timeline access only to the active call room', () => {
		expect(allowed('org.matrix.msc2762.timeline:!call:hs')).toBe(true);
		expect(allowed('org.matrix.msc2762.timeline:!other:hs')).toBe(false);
		expect(allowed('org.matrix.msc2762.timeline:*')).toBe(false);
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

describe('MSC4039 media', () => {
	it('grants download_file so the widget can render avatars', () => {
		expect(allowed('org.matrix.msc4039.download_file')).toBe(true);
	});

	it('denies upload_file: a call widget never writes media', () => {
		expect(allowed('org.matrix.msc4039.upload_file')).toBe(false);
	});

	it('denies get_media_config, which we never granted', () => {
		expect(allowed('org.matrix.msc4039.get_media_config')).toBe(false);
	});
});

describe('the ORISO identity record', () => {
	const IDENTITY = 'org.oriso.call.identity';

	it('lets the widget read who everybody is, as a timeline event', () => {
		// A timeline event, because room state is not encrypted: an identity
		// in state is a record the homeserver can read.
		expect(allowed(`org.matrix.msc2762.receive.event:${IDENTITY}`)).toBe(
			true
		);
	});

	it('does not let the widget send one, not even its own', () => {
		/*
		 * The whole rule is that the call is told identities and never
		 * decides one. The send and receive sets differ by exactly this
		 * event; before the transport moved, both room-event directions were
		 * checked against a single set, so granting the read would have
		 * granted the write with it.
		 */
		expect(allowed(`org.matrix.msc2762.send.event:${IDENTITY}`)).toBe(
			false
		);
	});

	it('no longer grants it as room state, in either direction', () => {
		for (const prefix of [
			'org.matrix.msc2762.receive.state_event',
			'org.matrix.msc2762.send.state_event'
		]) {
			for (const stateKey of ['', '@a:hs', '#@a:hs']) {
				expect(allowed(`${prefix}:${IDENTITY}${stateKey}`)).toBe(false);
			}
		}
	});

	it('still grants the events the call actually sends', () => {
		// The split must not have narrowed the send set by accident.
		for (const type of [
			'io.element.call.encryption_keys',
			'org.matrix.msc4075.rtc.notification',
			'm.reaction',
			'io.element.call.reaction'
		]) {
			expect(allowed(`org.matrix.msc2762.send.event:${type}`)).toBe(true);
			expect(allowed(`org.matrix.msc2762.receive.event:${type}`)).toBe(
				true
			);
		}
	});

	it('still denies an event type nobody granted, both ways', () => {
		for (const direction of ['send', 'receive']) {
			expect(
				allowed(`org.matrix.msc2762.${direction}.event:m.room.message`)
			).toBe(false);
		}
	});
});
