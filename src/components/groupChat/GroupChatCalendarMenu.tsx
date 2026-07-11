import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Button, Menu, MenuItem, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	buildNeutralGroupChatCalendar,
	downloadNeutralGroupChatIcs
} from './groupChatCalendar';

interface GroupChatCalendarMenuProps {
	start: Date;
	durationMinutes: number;
	eventId: string | number;
}

export const GroupChatCalendarMenu = ({
	start,
	durationMinutes,
	eventId
}: GroupChatCalendarMenuProps) => {
	const { t: translate } = useTranslation();
	const instanceId = useId().replace(/:/g, '');
	const triggerId = `${instanceId}-group-chat-calendar-trigger`;
	const menuId = `${instanceId}-group-chat-calendar-menu`;
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const defaultTitle = translate('groupChat.calendar.defaultTitle');
	const [title, setTitle] = useState(() => defaultTitle);
	const titleEdited = useRef(false);
	useEffect(() => {
		if (!titleEdited.current) {
			setTitle(defaultTitle);
		}
	}, [defaultTitle]);
	const closeMenu = () => setAnchor(null);
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
			<Menu
				id={menuId}
				MenuListProps={{ 'aria-labelledby': triggerId }}
				anchorEl={anchor}
				open={Boolean(anchor)}
				onClose={closeMenu}
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
						closeMenu();
					}}
				>
					{translate('groupChat.calendar.download')}
				</MenuItem>
				<MenuItem
					component="a"
					href={calendar.googleUrl}
					target="_blank"
					rel="noreferrer"
					onClick={closeMenu}
				>
					{translate('groupChat.calendar.google')}
				</MenuItem>
				<MenuItem
					component="a"
					href={calendar.outlookUrl}
					target="_blank"
					rel="noreferrer"
					onClick={closeMenu}
				>
					{translate('groupChat.calendar.outlook')}
				</MenuItem>
			</Menu>
		</>
	);
};
