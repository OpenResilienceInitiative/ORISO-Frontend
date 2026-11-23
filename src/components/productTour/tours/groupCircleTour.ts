import { getConversationFormatAvailability } from '../../conversationCreate/formatAvailability';
import type { TourAvailabilityContext } from '../tourCatalogue';
import type { TourDefinition } from '../types';

type FormatTenant = Parameters<typeof getConversationFormatAvailability>[0];

/**
 * The tour is offered exactly when the create flow offers the circle
 * format: `featureSelfHelpGroupsEnabled ?? featureGroupChatV2Enabled ===
 * true` (unset = OFF), refined by the counsellor's agencies. Agency
 * settings come from the user data when present; without them the
 * Träger's answer stands, as in `getConversationFormatAvailability`.
 */
export const isGroupCircleTourAvailable = ({
	flags,
	userData
}: TourAvailabilityContext): boolean =>
	getConversationFormatAvailability(
		{ settings: (flags ?? {}) as NonNullable<FormatTenant>['settings'] },
		(userData?.agencies ?? []).map((agency) => ({
			id: agency.id,
			settings: agency.settings
		}))
	).circle;

/**
 * FE#2341: creating a Gesprächskreis, watch-only. The create button, the
 * circle card and its topic picker are optional: the picker screen is
 * skipped with a single format, phones get compact rows instead of cards,
 * and the create entry is hidden without any format. Everything after the
 * topic (language, co-moderators, sharing, waiting room, start) lives in
 * a wizard step without a URL or in a dialog, so one centred step covers it.
 */
export const consultantGroupCircleTour: TourDefinition = {
	id: 'consultant-group-circle',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.groupCircle.title',
	summaryKey: 'tour.groupCircle.summary',
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 'tour.groupCircle.step.intro.title',
			contentKey: 'tour.groupCircle.step.intro.intro'
		},
		{
			id: 'create',
			route: '/sessions/consultant/sessionView',
			target: 'groupchat-create-button',
			placement: 'bottom',
			optional: true,
			titleKey: 'tour.groupCircle.step.create.title',
			contentKey: 'tour.groupCircle.step.create.intro'
		},
		{
			id: 'format',
			route: '/sessions/consultant/sessionView/createGroupChat/',
			target: 'groupchat-format-circle',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.groupCircle.step.format.title',
			contentKey: 'tour.groupCircle.step.format.intro'
		},
		{
			id: 'topic',
			target: 'groupchat-topic-picker',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.groupCircle.step.topic.title',
			contentKey: 'tour.groupCircle.step.topic.intro'
		},
		{
			id: 'settings',
			target: '',
			placement: 'center',
			titleKey: 'tour.groupCircle.step.settings.title',
			contentKey: 'tour.groupCircle.step.settings.intro'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.groupCircle.step.done.title',
			contentKey: 'tour.groupCircle.step.done.intro'
		}
	]
};
