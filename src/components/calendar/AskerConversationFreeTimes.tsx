import * as React from 'react';
import { useSyncExternalStore } from 'react';
import type { ComponentProps } from 'react';
import { useConsultingType } from '../../globalState';
import { useSessionTenantSettings } from '../../hooks/useSessionTenantSettings';
import { useSessionAgencyPolicy } from '../../hooks/useSessionAgencyPolicy';
import { resolveFeaturesForAgencyPolicy } from '../../hooks/useConversationFeatureSettings';
import {
	getAuthenticatedTenantId,
	subscribeToAuthenticatedTenant
} from '../../utils/authenticatedTenant';
import {
	resolveCallFeatureGates,
	type CallChatType
} from '../call/callFeatureGates';
import type { SelfBookingMedium } from '../../api/apiSessionAppointments';
import { AskerFreeTimesPanel } from './AskerFreeTimesPanel';

/**
 * The media a conversation lets its advice seeker book: the same gates as the
 * conversation's own call buttons (`SessionMenu`: tenant and agency call
 * settings for the chat type, and the consulting type's video-call switch).
 * Null while the answer is still loading; empty when nothing may be booked.
 */
export const permittedBookingMedia = ({
	videoCallAllowed,
	gates
}: {
	videoCallAllowed: boolean;
	gates: { audio: boolean; video: boolean };
}): SelfBookingMedium[] =>
	videoCallAllowed
		? [
				...(gates.video ? (['VIDEO'] as const) : []),
				...(gates.audio ? (['PHONE'] as const) : [])
			]
		: [];

type PanelProps = Omit<ComponentProps<typeof AskerFreeTimesPanel>, 'media'>;

interface AskerConversationFreeTimesProps extends PanelProps {
	agencyId?: number;
	consultingTypeId?: number;
	chatType: CallChatType;
}

/**
 * *2c (FE#2494): the free office hours of one conversation's counsellor,
 * offered only in the media that conversation permits.
 */
export const AskerConversationFreeTimes = ({
	agencyId,
	consultingTypeId,
	chatType,
	...panel
}: AskerConversationFreeTimesProps) => {
	const tenantId = useSyncExternalStore(
		subscribeToAuthenticatedTenant,
		getAuthenticatedTenantId
	);
	const { settings, isLoading } = useSessionTenantSettings(panel.sessionId);
	const { policy } = useSessionAgencyPolicy(panel.sessionId, agencyId);
	const consultingType = useConsultingType(consultingTypeId);
	if (isLoading || policy.state === 'loading' || !consultingType) return null;
	const features = resolveFeaturesForAgencyPolicy(
		settings,
		policy,
		agencyId,
		tenantId
	);
	const media = permittedBookingMedia({
		videoCallAllowed: Boolean(consultingType.isVideoCallAllowed),
		gates: resolveCallFeatureGates(features, chatType)
	});
	if (media.length === 0) return null;
	return <AskerFreeTimesPanel {...panel} media={media} />;
};
