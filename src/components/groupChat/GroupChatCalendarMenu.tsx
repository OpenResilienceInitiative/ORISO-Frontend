import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Button, Menu, MenuItem, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
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
	/** `id` of the element that opened the menu, for `aria-labelledby`. */
	triggerId?: string;
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
	triggerId,
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
		<Menu
			id={id}
			MenuListProps={
				triggerId ? { 'aria-labelledby': triggerId } : undefined
			}
			anchorEl={anchorEl}
			open={Boolean(anchorEl)}
			onClose={onClose}
		>
			<Box component="div" role="none" sx={{ padding: 1 }}>
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
				/>
			</Box>
			<MenuItem
				onClick={() => {
					downloadNeutralGroupChatIcs(calendar.ics);
					onClose();
				}}
			>
				{translate('groupChat.calendar.download')}
			</MenuItem>
			<MenuItem
				component="a"
				href={calendar.googleUrl}
				target="_blank"
				rel="noreferrer"
				onClick={onClose}
			>
				{translate('groupChat.calendar.google')}
			</MenuItem>
			<MenuItem
				component="a"
				href={calendar.outlookUrl}
				target="_blank"
				rel="noreferrer"
				onClick={onClose}
			>
				{translate('groupChat.calendar.outlook')}
			</MenuItem>
		</Menu>
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

	return (
		<>
			<Button
				id={triggerId}
				variant="outlined"
				onClick={(event) => setAnchor(event.currentTarget)}
				aria-haspopup="menu"
				aria-expanded={Boolean(anchor)}
				aria-controls={anchor ? menuId : undefined}
			>
				{translate('groupChat.calendar.add')}
			</Button>
			<GroupChatCalendarPopover
				id={menuId}
				triggerId={triggerId}
				anchorEl={anchor}
				onClose={() => setAnchor(null)}
				start={start}
				durationMinutes={durationMinutes}
				eventId={eventId}
			/>
		</>
	);
};
