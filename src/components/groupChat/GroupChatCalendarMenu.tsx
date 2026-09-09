import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
	Alert,
	Box,
	Button,
	Popover,
	Fade,
	IconButton,
	Tooltip,
	TextField,
	Typography
} from '@mui/material';
import {
	ChatMenuDropdownItem,
	ChatMenuDropdownDivider
} from '../chatMenuDropdown/ChatMenuDropdown';
import { useChatMenuPosition } from '../chatMenuDropdown/useChatMenuPosition';
import { CopyIcon } from '../../resources/img/icons';
import googleCalendarIcon from '../../resources/img/icons/googlecalendar.svg';
import outlookCalendarIcon from '../../resources/img/icons/outlook-calendar.svg';
import icsIcon from '../../resources/img/icons/download.svg';
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
	const anchorRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const menuStyle = useChatMenuPosition({
		open: Boolean(anchor),
		anchorRef,
		menuRef,
		width: 360
	});
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
				ref={anchorRef}
				variant="outlined"
				onClick={(event) => {
					setCopyState(null);
					setAnchor(event.currentTarget);
				}}
				sx={{ minHeight: 44, textTransform: 'none' }}
				aria-haspopup="dialog"
				aria-expanded={Boolean(anchor)}
				aria-controls={anchor ? menuId : undefined}
			>
				{translate('groupChat.calendar.add')}
			</Button>
			<Popover
				anchorReference="none"
				TransitionComponent={Fade}
				PaperProps={{
					'ref': menuRef,
					'id': menuId,
					'role': 'dialog',
					'aria-labelledby': triggerId,
					'className': 'chatMenuDropdown',
					'style': menuStyle,
					'sx': { width: 360 }
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
				<ChatMenuDropdownItem
					icon={<img src={icsIcon} alt="" width={20} height={20} />}
					title={translate('groupChat.calendar.download')}
					onClick={() => {
						downloadNeutralGroupChatIcs(calendar.ics);
						closeMenu();
					}}
				/>
				<ChatMenuDropdownDivider />
				<Box sx={{ px: 1, pb: 1 }}>
					<Typography variant="body2" color="text.secondary">
						{translate('groupChat.calendar.shareHint')}
					</Typography>
				</Box>
				{(
					[
						[
							'google',
							googleCalendarIcon,
							calendar.googleUrl,
							'copyGoogle'
						],
						[
							'outlook',
							outlookCalendarIcon,
							calendar.outlookUrl,
							'copyOutlook'
						]
					] as const
				).map(([provider, icon, url, copyLabel]) => (
					<Box
						key={provider}
						sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
					>
						<ChatMenuDropdownItem
							as="a"
							href={url}
							target="_blank"
							rel="noreferrer"
							onClick={closeMenu}
							icon={
								<img src={icon} alt="" width={20} height={20} />
							}
							title={translate(`groupChat.calendar.${provider}`)}
						/>
						<Tooltip
							title={translate(`groupChat.calendar.${copyLabel}`)}
						>
							<span>
								<IconButton
									aria-label={translate(
										`groupChat.calendar.${copyLabel}`
									)}
									disabled={copyState === 'pending'}
									onClick={() => void copyLink(url)}
									sx={{
										'width': 44,
										'height': 44,
										'& svg': { width: 20, height: 20 }
									}}
								>
									<CopyIcon />
								</IconButton>
							</span>
						</Tooltip>
					</Box>
				))}
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
