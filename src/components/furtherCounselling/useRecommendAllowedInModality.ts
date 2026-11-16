import { useContext, useSyncExternalStore } from 'react';
import { ActiveSessionContext } from '../../globalState';
import { resolveConversationAgencyId } from '../../utils/conversationFeatureSettings';
import {
	getAuthenticatedTenantId,
	subscribeToAuthenticatedTenant
} from '../../utils/authenticatedTenant';
import { getModality, Modality } from '../session/getModality';
import {
	canRecommendInModality,
	isLiveChatFurtherCounsellingEnabled
} from './furtherCounsellingRules';

/**
 * FE#2251: whether the open conversation's kind allows "Weitere Beratung
 * empfehlen". A 1:1 conversation always does; an anonymous live chat only
 * when its counselling centre switched it on. The audience (assigned
 * counsellor of an accepted conversation) stays `canRecommendFurtherCounselling`.
 */
export const useRecommendAllowedInModality = (): boolean => {
	const context = useContext(ActiveSessionContext);
	const tenantId = useSyncExternalStore(
		subscribeToAuthenticatedTenant,
		getAuthenticatedTenantId
	);
	const activeSession = context?.activeSession;
	const isLiveChat =
		!!activeSession && getModality(activeSession) === Modality.LIVE_CHAT;
	return canRecommendInModality({
		isLiveChat,
		liveChatEnabled:
			isLiveChat &&
			isLiveChatFurtherCounsellingEnabled(
				context?.agencyFeaturePolicy,
				resolveConversationAgencyId(activeSession?.item),
				tenantId
			)
	});
};
