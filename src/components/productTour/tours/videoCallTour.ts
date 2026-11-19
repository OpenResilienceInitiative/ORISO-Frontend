import type { TourDefinition } from '../types';

/**
 * FE#2342: Video calls for counsellors. Difference-first: a call starts
 * inside a conversation, not from a separate tool, and people who join later
 * knock and wait to be let in. Watch-only — no step starts a call, and the
 * running call (its iframe) is never targeted; admitting is explained in a
 * centred step. Header buttons exist only with an open conversation (and
 * move into the ⋮ menu below compact width), the help page is replaced when
 * a documentation link is configured — those steps are optional.
 *
 * Gated like the one-on-one header button (`call/callFeatureGates.ts`):
 * calls, video calls and video in one-on-one chats must all be on.
 */
export const consultantVideoCallTour: TourDefinition = {
	id: 'consultant-video-call',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.videoCall.title',
	summaryKey: 'tour.videoCall.summary',
	when: [
		{ flag: 'featureCallsEnabled' },
		{ flag: 'featureVideoCallsEnabled' },
		{ flag: 'featureVideoCallsOneOnOneChatsEnabled' }
	],
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 'tour.videoCall.step.intro.title',
			contentKey: 'tour.videoCall.step.intro.intro'
		},
		{
			id: 'session-call-button',
			target: 'session-video-call-button',
			placement: 'bottom',
			optional: true,
			titleKey: 'tour.videoCall.step.sessionCallButton.title',
			contentKey: 'tour.videoCall.step.sessionCallButton.intro'
		},
		{
			id: 'group-call-button',
			target: 'groupchat-call-button',
			placement: 'bottom',
			optional: true,
			titleKey: 'tour.videoCall.step.groupCallButton.title',
			contentKey: 'tour.videoCall.step.groupCallButton.intro'
		},
		{
			id: 'knock',
			target: '',
			placement: 'center',
			titleKey: 'tour.videoCall.step.knock.title',
			contentKey: 'tour.videoCall.step.knock.intro'
		},
		{
			id: 'help',
			route: '/profile/hilfe/videoCall',
			target: 'help-video-call',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.videoCall.step.help.title',
			contentKey: 'tour.videoCall.step.help.intro'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.videoCall.step.done.title',
			contentKey: 'tour.videoCall.step.done.intro'
		}
	]
};
