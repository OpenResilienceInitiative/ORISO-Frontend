import { describe, expect, it } from 'vitest';
import { resolvePreviewChannel } from './previewChannel';

const resolve = (actionPath: string | null, eventType = 'message.new') =>
	resolvePreviewChannel({ actionPath, eventType });

describe('resolvePreviewChannel (#1824)', () => {
	it('main room', () => {
		expect(resolve('/sessions/consultant/sessionView/!r:x/13')).toEqual({
			kind: null,
			threadRootId: null
		});
	});

	it('thread', () => {
		expect(
			resolve(
				'/sessions/consultant/sessionView/!r:x/13?channel=thread:$root'
			)
		).toEqual({ kind: 'thread', threadRootId: '$root' });
	});

	it('legacy threadRootId link', () => {
		expect(
			resolve(
				'/sessions/consultant/sessionView/!r:x/13?threadRootId=$root'
			)
		).toEqual({ kind: 'thread', threadRootId: '$root' });
	});

	it.each([
		['?channel=team', 'team'],
		['?channel=supervision', 'supervision'],
		['?teamDiscussion=1', 'team']
	])('%s is the internal %s room', (query, kind) => {
		expect(
			resolve(`/sessions/consultant/sessionView/!r:x/13${query}`).kind
		).toBe(kind);
	});

	it('an unknown channel value fails closed as an internal room', () => {
		expect(
			resolve('/sessions/consultant/sessionView/!r:x/13?channel=whatever')
				.kind
		).toBe('team');
	});

	it.each(['team.discussion.new', 'supervision.message.new'])(
		'event type %s is internal even without a channel in the path',
		(eventType) => {
			expect(
				resolve('/sessions/consultant/sessionView/!r:x/13', eventType)
					.kind
			).not.toBeNull();
		}
	);
});
