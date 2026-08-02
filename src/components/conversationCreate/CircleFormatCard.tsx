import * as React from 'react';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ConversationCircleIcon } from '../../resources/img/icons/conversation-create/conversation-circle.svg';
import groupCircleDefaultImage from '../../resources/img/illustrations/group-circle-default.png';
import groupCircleTopicFallbackImage from '../../resources/img/illustrations/group-circle-topic-fallback.png';
import { FormatCard } from './FormatCard';

interface CircleFormatCardProps {
	selectedTopic: string;
	children: React.ReactNode;
}

/**
 * Figma 8467:28516 / 8482:30555. The generic group-circle illustration is
 * the empty selection; until dedicated per-topic art exists, every selected
 * topic deliberately uses the debt illustration as the shared fallback.
 */
export const CircleFormatCard = ({
	selectedTopic,
	children
}: CircleFormatCardProps) => {
	const { t: translate } = useTranslation();

	return (
		<FormatCard
			className={`conversationCreate__formatCard${
				selectedTopic
					? ' conversationCreate__formatCard--selected'
					: ''
			}`}
			title={translate('groupChat.circle.title')}
			subtitle={translate('groupChat.circle.subtitle')}
			avatar={<ConversationCircleIcon />}
			headerAction={
				<button
					type="button"
					className="formatCard__menuButton"
					aria-label={translate('groupChat.format.cardMenu')}
					disabled
				>
					<MoreVertRoundedIcon aria-hidden="true" />
				</button>
			}
			media={
				<img
					src={
						selectedTopic
							? groupCircleTopicFallbackImage
							: groupCircleDefaultImage
					}
					alt={translate('groupChat.circle.imageAlt')}
				/>
			}
		>
			<div className="conversationCreate__cardCopy">
				<p className="conversationCreate__cardHeadline">
					{translate('groupChat.circle.cardHeadline')}
				</p>
				<p className="conversationCreate__cardSubheadline">
					{translate('groupChat.circle.cardSubheadline')}
				</p>
				<p className="conversationCreate__cardText">
					{translate('groupChat.circle.cardDescription')}
				</p>
			</div>
			{children}
		</FormatCard>
	);
};
