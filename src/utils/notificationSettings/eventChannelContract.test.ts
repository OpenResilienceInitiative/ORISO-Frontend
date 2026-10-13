import { describe, expect, it } from 'vitest';
import { resolveEventChannelContract as resolve } from './occasionChannelContract';

describe('event channel contract', () => {
	it('resolves the actual message recipient without coupling its browser slot to email storage', () => {
		expect(resolve('message.new', 'user')).toEqual({
			association: {
				kind: 'mapped',
				role: 'asker',
				occasions: ['neue-nachricht']
			},
			browser: {
				family: 'messages',
				area: 'conversations',
				kind: 'standard'
			}
		});
		expect(resolve('message.new', 'consultant')?.association).toEqual({
			kind: 'mapped',
			role: 'consultant',
			occasions: ['neue-nachricht', 'neue-nachricht-beratung']
		});
	});

	it('routes requests and mentions through the existing browser slots', () => {
		expect(resolve('request.new', 'consultant')).toMatchObject({
			association: { kind: 'mapped', occasions: ['neue-anfrage'] },
			browser: { family: 'requests', area: 'requests', kind: 'new' }
		});
		expect(
			resolve('message.new', 'consultant', { mentioned: true })?.browser
		).toEqual({
			family: 'messages',
			area: 'conversations',
			kind: 'mention'
		});
	});

	it('retains browser routing when a known event has no mail association', () => {
		expect(resolve('inquiry.accepted', 'user')).toEqual({
			association: { kind: 'unmapped', role: 'asker' },
			browser: { family: 'requests', area: 'requests', kind: 'standard' }
		});
	});

	it('names unknown events and recipients without suppressing their existing browser fallback', () => {
		expect(resolve('future.event', 'user')).toEqual({
			association: { kind: 'unknown-event' },
			browser: {
				family: 'system',
				area: 'conversations',
				kind: 'standard'
			}
		});
		expect(resolve('message.new', null)).toEqual({
			association: { kind: 'unknown-recipient' },
			browser: {
				family: 'messages',
				area: 'conversations',
				kind: 'standard'
			}
		});
		expect(resolve('message.new', 'tenant-admin')?.association).toEqual({
			kind: 'unknown-recipient'
		});
	});

	it('preserves explicit legacy family routing without inventing an occasion', () => {
		expect(resolve('', null, { family: 'calls' })).toEqual({
			association: { kind: 'unknown-event' },
			browser: { family: 'calls', area: 'timeCritical', kind: 'call' }
		});
	});
});
