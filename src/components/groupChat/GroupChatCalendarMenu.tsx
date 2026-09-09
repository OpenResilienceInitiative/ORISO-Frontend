import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
	Alert,
	Box,
	Button,
	Popover,
	MenuList,
	MenuItem,
	TextField,
	Typography
} from '@mui/material';
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
	const [copyState, setCopyState] = useState<
		'pending' | 'success' | 'error' | null
	>(null);
	const copyLink = async (url: string) => {
		setCopyState('pending');
		try {
			await navigator.clipboard.writeText(url);
			setCopyState('success');
		} catch {
			setCopyState('error');
		}
	};
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
				onClick={(event) => {
					setCopyState(null);
					setAnchor(event.currentTarget);
				}}
				sx={{ minHeight: 44, textTransform: 'none' }}
				aria-haspopup="menu"
				aria-expanded={Boolean(anchor)}
				aria-controls={anchor ? menuId : undefined}
			>
				{translate('groupChat.calendar.add')}
			</Button>
			<Popover
				PaperProps={{
					sx: { width: 360, maxWidth: 'calc(100vw - 32px)' }
				}}
				anchorEl={anchor}
				open={Boolean(anchor)}
				onClose={closeMenu}
			>
				<Box sx={{ padding: 1 }}>
					<TextField
						autoFocus
						label={translate('groupChat.calendar.titleLabel')}
						value={title}
						onChange={(event) => {
							titleEdited.current = true;
							setTitle(event.target.value);
							setCopyState(null);
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
				<Box sx={{ px: 2, py: 1 }}>
					<Typography variant="body2" color="text.secondary">
						{translate('groupChat.calendar.shareHint')}
					</Typography>
				</Box>
				<MenuList
					id={menuId}
					aria-labelledby={triggerId}
					sx={{
						'& .MuiMenuItem-root': {
							minHeight: 44,
							whiteSpace: 'normal'
						}
					}}
				>
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

					<MenuItem
						disabled={copyState === 'pending'}
						onClick={() => void copyLink(calendar.googleUrl)}
					>
						{translate('groupChat.calendar.copyGoogle')}
					</MenuItem>
					<MenuItem
						disabled={copyState === 'pending'}
						onClick={() => void copyLink(calendar.outlookUrl)}
					>
						{translate('groupChat.calendar.copyOutlook')}
					</MenuItem>
				</MenuList>
				{(copyState === 'success' || copyState === 'error') && (
					<Box sx={{ px: 1, py: 1 }}>
						<Alert
							severity={
								copyState === 'success' ? 'success' : 'error'
							}
							role={copyState === 'success' ? 'status' : 'alert'}
						>
							{translate(
								copyState === 'success'
									? 'groupChat.calendar.linkCopied'
									: 'groupChat.calendar.copyError'
							)}
						</Alert>
					</Box>
				)}
			</Popover>
		</>
	);
};
