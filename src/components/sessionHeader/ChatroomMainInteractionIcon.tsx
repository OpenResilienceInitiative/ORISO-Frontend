import * as React from 'react';
import clsx from 'clsx';
import { ConsultantSearchLoader } from './ConsultantSearchLoader';
import addIcon from '../../resources/img/icons/chatroom/add_icon.svg';
import internalConversationIcon from '../../resources/img/icons/chatroom/internal_conversation_200.svg';
import liveConversationIcon from '../../resources/img/icons/chatroom/live_conv_type_200.svg';
import mailConversationIcon from '../../resources/img/icons/chatroom/mail_conv_type_200.svg';

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
	/**
	 * FE#1115 — no counsellor has accepted yet. The enquiry's magnet starts
	 * sweeping and sends its beam out of the capsule. It is the same drawing
	 * either way, so nothing in the row changes size or place when the
	 * search ends.
	 */
	isSearching?: boolean;
}

const conversationIconSources: Partial<
	Record<ChatroomConversationIconType, string>
> = {
	internal: internalConversationIcon,
	live: liveConversationIcon,
	nearby: mailConversationIcon
};

export const ChatroomMainInteractionIcon = ({
	addLabel,
	className,
	onAddClick,
	showAddIcon = false,
	type,
	isSearching = false
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
				isSearching && 'chatroomMainInteractionIcon--searching',
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
					/* FE#513: never a dead decorative element — a real
					   disabled button with an honest tooltip. */
					<button
						type="button"
						className="chatroomMainInteractionIcon__add chatroomMainInteractionIcon__add--disabled"
						aria-label={addLabel}
						title={addLabel}
						disabled
					>
						{addContent}
					</button>
				))}
			<span
				className="chatroomMainInteractionIcon__type"
				aria-hidden="true"
			>
				{iconSource && (
					<span
						className="chatroomMainInteractionIcon__typeMask"
						style={
							{
								'--chatroom-main-icon-url': `url("${iconSource}")`
							} as React.CSSProperties
						}
					/>
				)}
				{/* FE#1115: the enquiry's glyph IS the magnet — the same
				    drawing the search indicator animates, so the capsule
				    never holds two versions of one object. */}
				{!iconSource && type === 'inquiry' && (
					<ConsultantSearchLoader animated={isSearching} />
				)}
				{!iconSource && type !== 'inquiry' && (
					<span className="chatroomMainInteractionIcon__typeGenerated" />
				)}
			</span>
		</span>
	);
};
