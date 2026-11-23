import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, BUTTON_TYPES } from '../button/Button';
import { ReactComponent as TeamActionGlyph } from '../../resources/img/icons/speech-bubble-team.svg';

/** The enquiry action keeps the same unread indication as other team entries. */
export const EnquiryTeamAction = ({
	onOpen,
	unreadCount = 0
}: {
	onOpen: () => void;
	unreadCount?: number;
}) => {
	const { t: translate } = useTranslation();
	const count = Math.max(0, unreadCount);
	const label = translate('enquiry.teamDiscussion.open');
	return (
		<Button
			item={{
				type: BUTTON_TYPES.SECONDARY,
				label: 'enquiry.teamDiscussion.open',
				title:
					count > 0
						? `${label}, ${translate('supervision.panel.unread', { count })}`
						: undefined,
				icon: <TeamActionGlyph aria-hidden="true" />
			}}
			className="session__teamDiscussionAction"
			testingAttribute="enquiry-open-team"
			tourTarget="enquiry-team-button"
			buttonHandle={onOpen}
		>
			{label}
			{count > 0 && (
				<span
					className="session__teamDiscussionUnread"
					aria-hidden="true"
				>
					{count > 99 ? '99+' : count}
				</span>
			)}
		</Button>
	);
};
