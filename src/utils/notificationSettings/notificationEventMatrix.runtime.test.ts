// @vitest-environment oriso-jsdom
/**
 * Cross-check (FE#1211, finding 5): the pop-up and "silent while open" columns
 * of the event table must equal what the runtime predicates decide for a feed
 * row shaped like UserService writes it (paths, params, recipientRole, as read
 * on origin/dev 2026-10-28). If either side changes alone, this fails.
 */
import { describe, expect, it } from 'vite-plus/test';
import {
	isLiveChatMessageForCounsellor,
	isLiveChatOpen
} from '../../components/notifications/LiveChatMessageNotice';
import { isNewEnquiryForCounsellor } from '../../components/notifications/NewEnquiryNotice';
import {
	eventNoticeKindFor,
	isEventNoticeTargetOpen,
	type EventNoticeFeedEvent
} from '../../components/notifications/EventNotice';
import {
	EVENT_CASES,
	NOTIFICATION_ROLES,
	type EventCase,
	type NotificationRole
} from './notificationChannelCapability';

const SESSION = '42';
const ROOM = '!abc:matrix.org';
const enc = encodeURIComponent;

type FeedRow = EventNoticeFeedEvent & {
	actionPath: string;
	sourceSessionId: string;
	params: NonNullable<EventNoticeFeedEvent['params']> & {
		conversationType?: string;
	};
};

/** The deep link UserService writes for this event and recipient. */
const actionPathFor = (eventType: string, role: NotificationRole) => {
	if (
		eventType === 'request.new' ||
		eventType === 'waiting_room.client.joined'
	)
		return role === 'consultant'
			? `/sessions/consultant/sessionPreview/${enc(ROOM)}/${SESSION}`
			: `/sessions/user/view/${enc(ROOM)}/${SESSION}`;
	if (eventType === 'team.discussion.new')
		return role === 'consultant'
			? `/sessions/consultant/sessionPreview?sessionId=${SESSION}&teamDiscussion=1&roomId=${enc('!team:matrix.org')}`
			: `/sessions/user/view/${enc(ROOM)}/${SESSION}`;
	if (eventType === 'case.handover.consent.requested')
		return role === 'asker'
			? `/sessions/user/view/session/${SESSION}?caseHandoverRequestId=7`
			: `/sessions/consultant/sessionView/${enc(ROOM)}/${SESSION}`;
	return role === 'consultant'
		? `/sessions/consultant/sessionView/${enc(ROOM)}/${SESSION}`
		: `/sessions/user/view/${enc(ROOM)}/${SESSION}`;
};

/** A feed row as the API returns it for `eventCase` addressed to `role`. */
const feedRow = (eventCase: EventCase, role: NotificationRole): FeedRow => {
	const { eventType, variant } = eventCase;
	const actionPath = actionPathFor(eventType, role);
	const common = { sourceSessionId: SESSION, actionPath, eventType };
	if (eventType === 'team.discussion.new')
		return {
			...common,
			params: {
				roomRef: undefined,
				senderDisplayName: 'Alex',
				mentioned: variant === 'mentioned'
			}
		};
	const params: FeedRow['params'] = {
		conversationType:
			variant === 'liveChat' ? 'LIVE_CHAT' : 'AGENCY_COUNSELLING',
		roomRef: ROOM
	};
	if (eventType === 'message.new' || eventType === 'thread.reply.new') {
		params.senderName = 'Alex';
		if (variant === 'mentioned') params.mentioned = true;
		params.recipientRole = role === 'consultant' ? 'consultant' : 'user';
	}
	if (eventType === 'case.handover.consent.requested')
		params.clientConsent = variant === 'optIn' ? 'OPT_IN' : 'OPT_OUT';
	return { ...common, params };
};

const hasCard = (row: FeedRow) =>
	isLiveChatMessageForCounsellor(row) ||
	isNewEnquiryForCounsellor(row) ||
	eventNoticeKindFor(row) !== null;

/**
 * Where the user is when the event's target is on screen. Normally the row's
 * own link; the team-discussion link is a bare redirect target that renders
 * an empty view, so the screen to compare with is the enquiry view with the
 * team channel open.
 */
const location = (row: FeedRow) => {
	if (row.eventType === 'team.discussion.new')
		return {
			pathname: `/sessions/consultant/sessionPreview/${enc(ROOM)}/${SESSION}`,
			search: '?channel=team'
		};
	const [pathname, search = ''] = row.actionPath.split('?');
	return { pathname, search: search ? `?${search}` : '' };
};

/** What the runtime does when the event's own target is on screen. */
const silentWhenTargetOpen = (row: FeedRow, visible = true): boolean => {
	const { pathname, search } = location(row);
	if (isLiveChatMessageForCounsellor(row))
		return isLiveChatOpen(row, decodeURI(pathname), visible);
	const kind = eventNoticeKindFor(row);
	if (!kind) return false; // new enquiry: card hidden, tone and banner stay
	return isEventNoticeTargetOpen(
		kind,
		{ sessionId: row.sourceSessionId, roomRef: row.params.roomRef },
		pathname,
		search,
		visible
	);
};

const caseId = (c: EventCase) =>
	c.variant ? `${c.eventType}+${c.variant}` : c.eventType;

describe('event table vs runtime predicates', () => {
	it.each(EVENT_CASES.map((c) => [caseId(c), c] as const))(
		'%s: pop-up for exactly the roles in popupFor',
		(_id, eventCase) => {
			for (const role of NOTIFICATION_ROLES) {
				expect(
					hasCard(feedRow(eventCase, role)),
					`${caseId(eventCase)} addressed as ${role}`
				).toBe(eventCase.popupFor?.includes(role) ?? false);
			}
		}
	);

	it.each(EVENT_CASES.map((c) => [caseId(c), c] as const))(
		'%s: silent while its target is open exactly when silentWhenOpen',
		(_id, eventCase) => {
			for (const role of eventCase.popupFor ?? []) {
				const row = feedRow(eventCase, role);
				expect(silentWhenTargetOpen(row), caseId(eventCase)).toBe(
					eventCase.silentWhenOpen === true
				);
				// A hidden tab never counts as "open": the card must wait.
				expect(silentWhenTargetOpen(row, false)).toBe(false);
			}
			if (!eventCase.popupFor?.length) {
				expect(eventCase.silentWhenOpen ?? false).toBe(false);
			}
		}
	);

	it('gives a mention card only to a team-discussion post that mentions a counsellor', () => {
		const post = feedRow(
			EVENT_CASES.find(
				(c) => caseId(c) === 'team.discussion.new+mentioned'
			)!,
			'consultant'
		);
		expect(eventNoticeKindFor(post)).toBe('mention');
		expect(
			eventNoticeKindFor({
				...post,
				params: { ...post.params, mentioned: false }
			})
		).toBeNull();
		expect(
			eventNoticeKindFor({ ...post, params: { mentioned: undefined } })
		).toBeNull();
		// An ordinary message never gets a mention card, whatever its flags say.
		expect(
			eventNoticeKindFor({
				...post,
				eventType: 'message.new',
				params: {
					...post.params,
					mentioned: true,
					recipientRole: 'consultant'
				}
			})
		).toBeNull();
	});

	it('gives the consent card only for OPT_IN to the advice seeker, never to a counsellor', () => {
		const consent = (
			clientConsent: string | undefined,
			role: NotificationRole
		) =>
			eventNoticeKindFor({
				...feedRow(
					EVENT_CASES.find(
						(c) => caseId(c) === 'case.handover.consent.requested'
					)!,
					role
				),
				params: { clientConsent }
			});
		expect(consent('OPT_IN', 'asker')).toBe('consent');
		for (const mode of ['OPT_OUT', 'NONE', undefined])
			expect(consent(mode, 'asker')).toBeNull();
		expect(consent('OPT_IN', 'consultant')).toBeNull();
	});

	it('treats a team-discussion mention as seen only on the enquiry view with the team channel open', () => {
		const post = feedRow(
			EVENT_CASES.find(
				(c) => caseId(c) === 'team.discussion.new+mentioned'
			)!,
			'consultant'
		);
		const target = { sessionId: SESSION, roomRef: undefined };
		const open = (pathname: string, search: string) =>
			isEventNoticeTargetOpen('mention', target, pathname, search, true);
		const enquiry = `/sessions/consultant/sessionPreview/${enc(ROOM)}/${SESSION}`;
		expect(open(enquiry, '?channel=team')).toBe(true);
		expect(open(enquiry, '?teamDiscussion=1')).toBe(true);
		// The enquiry's main chat does not show the discussion.
		expect(open(enquiry, '')).toBe(false);
		// The bare link UserService writes renders an empty view: not seen,
		// so the card, tone and banner still announce.
		const [barePath, bareSearch] = post.actionPath.split('?');
		expect(open(barePath, `?${bareSearch}`)).toBe(false);
		expect(silentWhenTargetOpen(post)).toBe(true);
	});
});
