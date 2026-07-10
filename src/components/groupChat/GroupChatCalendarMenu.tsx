import React, { useMemo, useState } from 'react';
import { Button, Menu, MenuItem, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	buildNeutralGroupChatCalendar,
	downloadNeutralGroupChatIcs
} from './groupChatCalendar';

interface GroupChatCalendarMenuProps {
	start: Date;
	durationMinutes: number;
}

export const GroupChatCalendarMenu = ({
	start,
	durationMinutes
}: GroupChatCalendarMenuProps) => {
	const { t: translate } = useTranslation();
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [title, setTitle] = useState(() =>
		translate('groupChat.calendar.defaultTitle')
	);
	const calendar = useMemo(
		() =>
			buildNeutralGroupChatCalendar({
				start,
				durationMinutes,
				title
			}),
		[durationMinutes, start, title]
	);

	return (
		<>
			<Button
				variant="outlined"
				onClick={(event) => setAnchor(event.currentTarget)}
			>
				{translate('groupChat.calendar.add')}
			</Button>
			<Menu
				anchorEl={anchor}
				open={Boolean(anchor)}
				onClose={() => setAnchor(null)}
			>
				<MenuItem disableRipple>
					<TextField
						label={translate('groupChat.calendar.titleLabel')}
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						size="small"
					/>
				</MenuItem>
				<MenuItem
					onClick={() => downloadNeutralGroupChatIcs(calendar.ics)}
				>
					{translate('groupChat.calendar.download')}
				</MenuItem>
				<MenuItem
					component="a"
					href={calendar.googleUrl}
					target="_blank"
					rel="noreferrer"
				>
					{translate('groupChat.calendar.google')}
				</MenuItem>
				<MenuItem
					component="a"
					href={calendar.outlookUrl}
					target="_blank"
					rel="noreferrer"
				>
					{translate('groupChat.calendar.outlook')}
				</MenuItem>
			</Menu>
		</>
	);
};
