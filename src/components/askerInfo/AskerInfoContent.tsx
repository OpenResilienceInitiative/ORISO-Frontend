import * as React from 'react';
import { useContext, useMemo } from 'react';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { offersCaseHandoverIn } from '../session/caseHandoverHelpers';
import {
	AUTHORITIES,
	hasUserAuthority,
	SessionTypeContext,
	TenantContext,
	UserDataContext,
	ActiveSessionContext
} from '../../globalState';
import { AskerInfoData } from './AskerInfoData';
import { AskerInfoAssign } from './AskerInfoAssign';
import '../profile/profile.styles';
import './askerInfo.styles';
import { AskerInfoTools } from './AskerInfoTools';
import { Box } from '../box/Box';
import { AskerInfoPrivacyNote } from './AskerInfoPrivacyNote';
import { AddonProfileTiles } from '../../addons/AddonProfileTiles';

export const AskerInfoContent = () => {
	const { tenant } = useContext(TenantContext);
	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);

	const { type } = useContext(SessionTypeContext);

	/*
	 * The assignment select only serves initial enquiry assignment (#1673).
	 * On an active case it could only post the removed REASSIGN_CONSULTANT
	 * alias (404); the owner hands over through the guarded case-handover
	 * offer instead, and non-owners get no reassignment control at all.
	 */
	const isEnquiryAssignAvailable = useMemo(
		() =>
			type === SESSION_LIST_TYPES.ENQUIRY &&
			!activeSession.isGroup &&
			!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
			hasUserAuthority(
				AUTHORITIES.ASSIGN_CONSULTANT_TO_ENQUIRY,
				userData
			),
		[activeSession, type, userData]
	);
	const isOwnerHandoverAvailable = useMemo(
		() =>
			type === SESSION_LIST_TYPES.MY_SESSION &&
			!activeSession.isGroup &&
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
			activeSession.consultant?.id === userData.userId,
		[activeSession, type, userData]
	);

	return (
		<>
			<AskerInfoPrivacyNote />
			<Box>
				<AskerInfoData />
			</Box>
			{tenant?.settings?.featureToolsEnabled && (
				<Box>
					<AskerInfoTools />
				</Box>
			)}
			<AddonProfileTiles />
			{(isEnquiryAssignAvailable || isOwnerHandoverAvailable) && (
				<Box>
					<div className="askerInfo__assign">
						<AskerInfoAssign
							showLegacyAssignment={isEnquiryAssignAvailable}
							handoverEnabled={
								isOwnerHandoverAvailable &&
								offersCaseHandoverIn(activeSession)
							}
						/>
					</div>
				</Box>
			)}
		</>
	);
};
