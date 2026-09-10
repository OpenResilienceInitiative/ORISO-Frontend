import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Popover, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	ChatMenuDropdown,
	ChatMenuDropdownItem
} from '../chatMenuDropdown/ChatMenuDropdown';
import { SplitButton } from '../splitButton/SplitButton';
import { ReactComponent as ScheduledMeetingIcon } from '../../resources/img/icons/scheduled_meeting_filled_24px.svg';
import googleCalendarIcon from '../../resources/img/icons/googlecalendar.svg';
import outlookCalendarIcon from '../../resources/img/icons/outlook-calendar.svg';
import icsIcon from '../../resources/img/icons/download.svg';
import {
	buildNeutralGroupChatCalendar,
	downloadNeutralGroupChatIcs
} from './groupChatCalendar';

interface GroupChatCalendarInputProps {
	start: Date;
	durationMinutes: number;
	eventId: string | number;
}

interface GroupChatCalendarPopoverProps extends GroupChatCalendarInputProps {
	/** The element the menu hangs from; `null` keeps it closed. */
	anchorEl: HTMLElement | null;
	onClose: () => void;
	id?: string;
}

/**
 * The calendar choices without their trigger. The waiting area of the chat
 * renders it under its own outlined button (`GroupChatCalendarMenu`); the
 * group entry room hangs it from the footer's action, which is a button it
 * does not own — so the menu had to be separable from what opens it.
 */
export const GroupChatCalendarPopover = ({
	start,
	durationMinutes,
	eventId,
	anchorEl,
	onClose,
	id
}: GroupChatCalendarPopoverProps) => {
	const { t: translate } = useTranslation();
	const defaultTitle = translate('groupChat.calendar.defaultTitle');
	const [title, setTitle] = useState(() => defaultTitle);
	const titleEdited = useRef(false);
	useEffect(() => {
		if (!titleEdited.current) {
			setTitle(defaultTitle);
		}
	}, [defaultTitle]);
	const calendar = useMemo(
		() =>
			buildNeutralGroupChatCalendar({
				start,
				durationMinutes,
				title,
				defaultTitle,
				eventId
			}),
		[defaultTitle, durationMinutes, eventId, start, title]
	);

	return (
		<Popover
			anchorEl={anchorEl}
			open={Boolean(anchorEl)}
			onClose={onClose}
			anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
			transformOrigin={{ vertical: 'top', horizontal: 'right' }}
			slotProps={{
				paper: {
					sx: {
						backgroundColor: 'var(--m3-surface-container, #f3edf7)',
						boxShadow:
							'var(--m3-elevation-2, 0 2px 6px rgba(0, 0, 0, 0.2))',
						borderRadius: '12px',
						overflow: 'visible'
					}
				}
			}}
		>
			<ChatMenuDropdown
				id={id}
				role="dialog"
				ariaLabel={translate('groupChat.calendar.add')}
			>
				<Box component="div" sx={{ padding: '8px 8px 12px' }}>
					<TextField
						label={translate('groupChat.calendar.titleLabel')}
						value={title}
						onChange={(event) => {
							titleEdited.current = true;
							setTitle(event.target.value);
						}}
						onKeyDown={(event) => {
							if (event.key !== 'Escape') {
								event.stopPropagation();
							}
						}}
						size="small"
						fullWidth
					/>
				</Box>
				<ChatMenuDropdownItem
					icon={<img src={icsIcon} alt="" width={20} height={20} />}
					title={translate('groupChat.calendar.download')}
					onClick={() => {
						downloadNeutralGroupChatIcs(calendar.ics);
						onClose();
					}}
				/>
				<ChatMenuDropdownItem
					as="a"
					href={calendar.googleUrl}
					target="_blank"
					rel="noreferrer"
					onClick={onClose}
					icon={
						<img
							src={googleCalendarIcon}
							alt=""
							width={20}
							height={20}
						/>
					}
					title={translate('groupChat.calendar.google')}
				/>
				<ChatMenuDropdownItem
					as="a"
					href={calendar.outlookUrl}
					target="_blank"
					rel="noreferrer"
					onClick={onClose}
					icon={
						<img
							src={outlookCalendarIcon}
							alt=""
							width={20}
							height={20}
						/>
					}
					title={translate('groupChat.calendar.outlook')}
				/>
			</ChatMenuDropdown>
		</Popover>
	);
};

export const GroupChatCalendarMenu = ({
	start,
	durationMinutes,
	eventId
}: GroupChatCalendarInputProps) => {
	const { t: translate } = useTranslation();
	const instanceId = useId().replace(/:/g, '');
	const triggerId = `${instanceId}-group-chat-calendar-trigger`;
	const menuId = `${instanceId}-group-chat-calendar-menu`;
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const triggerRef = useRef<HTMLDivElement | null>(null);
	const toggleMenu = () =>
		setAnchor((current) => (current ? null : triggerRef.current));

	return (
		<>
			<SplitButton
				ref={triggerRef}
				id={triggerId}
				label={translate('groupChat.calendar.add')}
				icon={<ScheduledMeetingIcon />}
				variant={anchor ? 'elevated' : 'outlined'}
				onClick={toggleMenu}
				onToggleMenu={toggleMenu}
				open={Boolean(anchor)}
				menuLabel={translate('groupChat.calendar.add')}
				popupRole="dialog"
				controlsId={menuId}
			/>
			<GroupChatCalendarPopover
				id={menuId}
				anchorEl={anchor}
				onClose={() => setAnchor(null)}
				start={start}
				durationMinutes={durationMinutes}
				eventId={eventId}
			/>
		</>
	);
};
