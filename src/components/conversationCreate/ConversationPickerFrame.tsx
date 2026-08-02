import * as React from 'react';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { ReactComponent as ConversationTypeSelectIcon } from '../../resources/img/icons/conversation-create/conversation-type-select.svg';

interface ConversationCreateFrameProps {
	headerTitle: string;
	menuLabel: string;
	children: React.ReactNode;
}

export const ConversationCreateFrame = ({
	headerTitle,
	menuLabel,
	children
}: ConversationCreateFrameProps) => (
	<div className="conversationCreate">
		<header className="conversationCreate__header">
			<span className="conversationCreate__headerIcon" aria-hidden="true">
				<AddCircleOutlineRoundedIcon />
			</span>
			<h3 className="conversationCreate__headerTitle">{headerTitle}</h3>
			<button
				type="button"
				className="conversationCreate__menuButton"
				aria-label={menuLabel}
				disabled
			>
				<MoreVertRoundedIcon aria-hidden="true" />
			</button>
		</header>
		{children}
	</div>
);

interface ConversationFormatIntroProps {
	title: string;
	subtitle: string;
}

export const ConversationFormatIntro = ({
	title,
	subtitle
}: ConversationFormatIntroProps) => (
	<div className="conversationCreate__intro">
		<div className="conversationCreate__introHeading">
			<ConversationTypeSelectIcon
				className="conversationCreate__introIcon"
				aria-hidden="true"
			/>
			<h2 className="conversationCreate__title">{title}</h2>
		</div>
		<p className="conversationCreate__subtitle">{subtitle}</p>
	</div>
);
