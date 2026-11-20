import {
	parseChannel,
	rewriteLegacyChannelPath
} from '../../utils/channelRoute';
import type { PreviewChannelKind } from './previewCapabilities';

/**
 * #1824: which channel of a conversation an activity event belongs to, from
 * its stored action path and event type. One parse feeds both the thread the
 * preview shows and the permission policy, and it fails closed: a path that
 * names a channel we do not understand, or an event type of the internal
 * rooms, is an internal room, never the main conversation.
 */
export const resolvePreviewChannel = ({
	actionPath,
	eventType
}: {
	actionPath?: string | null;
	eventType?: string | null;
}): { kind: PreviewChannelKind | null; threadRootId: string | null } => {
	const path = rewriteLegacyChannelPath(actionPath ?? null);
	const query = String(path || '').split('?')[1] || '';
	const params = new URLSearchParams(query);
	const { channel } = parseChannel(query ? `?${query}` : '');

	if (channel?.kind === 'thread') {
		return { kind: 'thread', threadRootId: channel.rootId };
	}
	if (channel?.kind === 'supervision' || channel?.kind === 'team') {
		return { kind: channel.kind, threadRootId: null };
	}
	if (params.get('teamDiscussion') === '1' || params.has('channel')) {
		return { kind: 'team', threadRootId: null };
	}
	if (eventType?.startsWith('team.discussion')) {
		return { kind: 'team', threadRootId: null };
	}
	if (eventType?.startsWith('supervision')) {
		return { kind: 'supervision', threadRootId: null };
	}
	return { kind: null, threadRootId: null };
};
