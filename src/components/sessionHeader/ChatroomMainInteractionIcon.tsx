import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import clsx from 'clsx';
import addIcon from '../../resources/img/icons/chatroom/add_icon.svg';
import internalConversationIcon from '../../resources/img/icons/chatroom/internal_conversation_200.svg';
import liveConversationIcon from '../../resources/img/icons/chatroom/live_conv_type_200.svg';
import mailConversationIcon from '../../resources/img/icons/chatroom/mail_conv_type_200.svg';
import nearbyConversationIcon from '../../resources/img/icons/chatroom/nearby_conv_type_200.svg';
import waitingRoomIcon from '../../resources/img/icons/chatroom/waiting_room_200.svg';

export type ChatroomConversationIconType =
	| 'active'
	| 'internal'
	| 'live'
	| 'nearby'
	| 'waiting'
	| 'inquiry';

interface ChatroomMainInteractionIconProps {
	addLabel?: string;
	className?: string;
	onAddClick?: () => void;
	showAddIcon?: boolean;
	type: ChatroomConversationIconType;
}

const conversationIconSources: Partial<
	Record<ChatroomConversationIconType, string>
> = {
	active: nearbyConversationIcon,
	internal: internalConversationIcon,
	live: liveConversationIcon,
	nearby: mailConversationIcon
};

export const ChatroomMainInteractionIcon = ({
	addLabel,
	className,
	onAddClick,
	showAddIcon = false,
	type
}: ChatroomMainInteractionIconProps) => {
	const resolvedAddLabel = addLabel ?? 'Person hinzufügen';
	const addContent = (
		<span className="chatroomMainInteractionIcon__addContent">
			<img
				src={addIcon}
				alt=""
				className="chatroomMainInteractionIcon__addImage"
				aria-hidden="true"
			/>
		</span>
	);
	const iconSource = conversationIconSources[type];
	const stateIcon = (() => {
		if (type === 'waiting') {
			return (
				<img
					src={waitingRoomIcon}
					alt=""
					className="chatroomMainInteractionIcon__typeImage"
				/>
			);
		}

		if (type === 'inquiry') {
			return (
				<span className="chatroomMainInteractionIcon__typeGenerated">
					<span className="chatroomMainInteractionIcon__magnetBackground">
						<span className="chatroomMainInteractionIcon__magnetGradient chatroomMainInteractionIcon__magnetGradient--top" />
						<span className="chatroomMainInteractionIcon__magnetGradient chatroomMainInteractionIcon__magnetGradient--bottom" />
					</span>
				</span>
			);
		}

		return iconSource ? (
			<span
				className="chatroomMainInteractionIcon__typeMask"
				style={
					{
						'--chatroom-main-icon-url': `url("${iconSource}")`
					} as React.CSSProperties
				}
			/>
		) : null;
	})();

	return (
		<span
			className={clsx(
				'chatroomMainInteractionIcon',
				`chatroomMainInteractionIcon--${type}`,
				showAddIcon && 'chatroomMainInteractionIcon--withAdd',
				className
			)}
		>
			{showAddIcon &&
				(onAddClick ? (
					<IconButton
						type="button"
						className="chatroomMainInteractionIcon__add chatroomMainInteractionIcon__add--interactive"
						aria-label={resolvedAddLabel}
						onClick={onAddClick}
					>
						{addContent}
					</IconButton>
				) : (
					/* FE#513: never a dead decorative element — a real
					   disabled button with an honest tooltip. */
					<IconButton
						type="button"
						className="chatroomMainInteractionIcon__add chatroomMainInteractionIcon__add--disabled"
						aria-label={resolvedAddLabel}
						title={resolvedAddLabel}
						disabled
					>
						{addContent}
					</IconButton>
				))}
			<span
				className="chatroomMainInteractionIcon__type"
				data-testid="chatroom-main-interaction-state-icon"
				aria-hidden="true"
			>
				{stateIcon}
			</span>
		</span>
	);
};
