import * as React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ActiveSessionContext,
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { useDepartmentLegal } from '../../api/useDepartmentLegal';
import { isPrivacyNoticeMissing } from '../registration/privacyNotice/hasStoredPrivacyNotice';
import { Notice } from '../notice/Notice';
import { NOTICE_TYPE_WARNING } from '../notice/types';

/**
 * Counsellor-only note: the centre of this session has no stored privacy
 * notice, so the advice seeker may have consented knowingly to that.
 *
 * Derived at read time from the public department-legal lookup and shown only
 * in the counsellor's panel. It is deliberately not a chat message (every room
 * member would see it) and nothing is stored about the person: ADR-022 rules
 * out a consent log. It only says that no text is stored, never that a stored
 * text is legally correct (ORISO-AgencyService#366).
 */
export const AskerInfoPrivacyNote = () => {
	const { t } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const { activeSession } = useContext(ActiveSessionContext);

	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const item = activeSession?.item;
	const topicId = (item?.topic as { id?: number } | undefined)?.id;
	const enabled = isConsultant && !activeSession?.isGroup && !!topicId;

	const { data } = useDepartmentLegal(item?.agencyId, topicId, { enabled });

	if (!enabled || !isPrivacyNoticeMissing(data)) {
		return null;
	}

	return (
		<Notice
			type={NOTICE_TYPE_WARNING}
			title={t('askerInfo.noPrivacyNotice.title')}
			className="askerInfo__privacyNote"
		>
			{t('askerInfo.noPrivacyNotice.text')}
		</Notice>
	);
};
