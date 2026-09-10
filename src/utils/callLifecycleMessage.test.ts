import { describe, expect, it } from 'vitest';
import {
	buildCallLifecycleContent,
	CALL_LIFECYCLE_MSGTYPE,
	collapseCallLifecycleMessages,
	parseCallLifecycleMessage
} from './callLifecycleMessage';

describe('call lifecycle room messages', () => {
	it('parses the backend-compatible contract without requiring optional fields', () => {
		expect(
			parseCallLifecycleMessage({
				'msgtype': CALL_LIFECYCLE_MSGTYPE,
				'org.oriso.call': {
					call_id: 'call-1',
					state: 'ended',
					call_type: 'audio',
					duration_seconds: 71,
					participants: ['user-1', '@marge:oriso.example']
				}
			})
		).toMatchObject({
			callId: 'call-1',
			state: 'ended',
			callType: 'audio',
			durationSeconds: 71,
			participants: [
				{ userId: 'user-1', displayName: 'user-1' },
				{ userId: '@marge:oriso.example', displayName: 'marge' }
			]
		});
	});

	it('builds a replacement that retains the complete typed payload', () => {
		const content = buildCallLifecycleContent(
			{
				callId: 'call-2',
				state: 'missed',
				callType: 'video',
				callRoomId: '!call:oriso.example',
				participants: []
			},
			'$initial'
		);

		expect(content['m.relates_to']).toEqual({
			rel_type: 'm.replace',
			event_id: '$initial'
		});
		expect(
			parseCallLifecycleMessage(content['m.new_content'])
		).toMatchObject({ callId: 'call-2', state: 'missed' });
	});

	it('collapses a cross-device fallback by callId into the original position', () => {
		const started = {
			_id: '$started',
			ts: new Date('2026-09-10T10:00:00Z'),
			callLifecycle: {
				callId: 'call-3',
				state: 'running' as const,
				callType: 'video' as const,
				participants: []
			}
		};
		const missed = {
			_id: '$missed',
			ts: new Date('2026-09-10T10:01:00Z'),
			callLifecycle: {
				callId: 'call-3',
				state: 'missed' as const,
				callType: 'video' as const,
				participants: []
			}
		};

		expect(collapseCallLifecycleMessages([started, missed])).toEqual([
			{
				...missed,
				_id: '$started',
				ts: started.ts
			}
		]);
	});

	it('does not parse a plain m.text payload as a call lifecycle event', () => {
		expect(
			parseCallLifecycleMessage({
				msgtype: 'm.text',
				call_id: 'call-x',
				state: 'ended'
			})
		).toBeNull();
	});

	it('still parses unwrapped notification params when msgtype is absent', () => {
		expect(
			parseCallLifecycleMessage({
				call_id: 'call-params',
				state: 'ended',
				call_type: 'audio'
			})
		).toMatchObject({ callId: 'call-params', state: 'ended' });
	});

	it('orders collapsed call state by lifecycle revision, not original display time', () => {
		const original = {
			_id: '$started',
			ts: new Date('2026-09-10T10:00:00Z'),
			callLifecycle: {
				callId: 'call-4',
				state: 'running' as const,
				callType: 'video' as const,
				participants: []
			}
		};
		const laterEnded = {
			_id: '$fallback',
			ts: new Date('2026-09-10T09:59:00Z'),
			callLifecycleRevisionTs: Date.parse('2026-09-10T10:02:00Z'),
			callLifecycle: {
				callId: 'call-4',
				state: 'ended' as const,
				callType: 'video' as const,
				participants: []
			}
		};

		expect(collapseCallLifecycleMessages([original, laterEnded])).toEqual([
			{
				...laterEnded,
				_id: '$started',
				ts: original.ts
			}
		]);
	});
});
