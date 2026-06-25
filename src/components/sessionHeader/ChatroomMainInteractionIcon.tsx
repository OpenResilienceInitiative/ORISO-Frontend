import * as React from 'react';
import clsx from 'clsx';
import addIcon from '../../resources/img/icons/chatroom/add_icon.svg';
import internalConversationIcon from '../../resources/img/icons/chatroom/internal_conversation_200.svg';
import liveConversationIcon from '../../resources/img/icons/chatroom/live_conv_type_200.svg';
import nearbyConversationIcon from '../../resources/img/icons/chatroom/nearby_conv_type_200.svg';

export type ChatroomConversationIconType =
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
	internal: internalConversationIcon,
	live: liveConversationIcon,
	nearby: nearbyConversationIcon
};

export const ChatroomMainInteractionIcon = ({
	addLabel,
	className,
	onAddClick,
	showAddIcon = false,
	type
}: ChatroomMainInteractionIconProps) => {
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
					<button
						type="button"
						className="chatroomMainInteractionIcon__add chatroomMainInteractionIcon__add--interactive"
						aria-label={addLabel}
						onClick={onAddClick}
					>
						{addContent}
					</button>
				) : (
					<span
						className="chatroomMainInteractionIcon__add"
						aria-hidden="true"
					>
						{addContent}
					</span>
				))}
			<span
				className="chatroomMainInteractionIcon__type"
				aria-hidden="true"
			>
				{iconSource ? (
					<span
						className="chatroomMainInteractionIcon__typeMask"
						style={
							{
								'--chatroom-main-icon-url': `url("${iconSource}")`
							} as React.CSSProperties
						}
					/>
				) : (
					<span className="chatroomMainInteractionIcon__typeGenerated" />
				)}
			</span>
		</span>
	);
};
