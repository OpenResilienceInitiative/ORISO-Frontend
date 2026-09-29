import * as React from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Avatar,
	Box,
	Button,
	Chip,
	IconButton,
	List,
	ListItem,
	ListItemAvatar,
	ListItemIcon,
	ListItemText,
	Typography
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';

/**
 * #1499 item 2 — the group Chat-Info (approved by Frank, 22.09.2026).
 *
 * The group "Chat-Info" rebuilt as a Material 3 surface that lives inside the
 * white chat card: a top bar with back action, a hero with the room's topic and
 * schedule, and three section cards (participants, team roles, room settings)
 * as M3 lists with leading icons. It is purely presentational — the route
 * component `GroupChatInfo` fetches, decides and maps its data onto these
 * props.
 *
 * Only M3 custom properties are used for colour (muted ORISO scheme), so the
 * scheme switcher and dark/contrast variants carry over without hand-picked
 * greys.
 */

export type GroupChatInfoSettingKey =
	| 'topic'
	| 'date'
	| 'time'
	| 'duration'
	| 'repetition'
	| 'agency'
	| 'hint'
	| 'creator'
	| 'createDate';

export interface GroupChatInfoSetting {
	key: GroupChatInfoSettingKey;
	label: string;
	value: string;
}

export interface GroupChatInfoParticipant {
	id: string;
	name: string;
	/** Login name, when it differs from the display name (ban API). */
	username?: string;
	/** Moderators cannot be banned, so they get no overflow menu. */
	isModerator?: boolean;
	/** A short state under the name, e.g. "Gebannt"; also hides the menu. */
	statusLabel?: string;
}

export type GroupChatTeamRole = 'OWNER' | 'CO_MODERATOR' | 'PARTICIPANT';

export interface GroupChatInfoTeamMember {
	id: string;
	name: string;
	role: GroupChatTeamRole;
}

export interface GroupChatInfoM3Props {
	topic: string;
	/** One line under the topic, e.g. "Mo, 21.09.26 · 14:34 Uhr · 1 Stunde". */
	scheduleSummary?: string;
	/** Short state label shown as a chip next to the schedule ("Geplant"). */
	statusLabel?: string;
	/** Whether the room is running right now — tints the status chip. */
	active?: boolean;
	/** The calendar action; the app passes the real `GroupChatCalendarMenu`. */
	calendarAction?: React.ReactNode;
	participants: GroupChatInfoParticipant[];
	/** Only moderators see the per-participant overflow menu. */
	canModerate?: boolean;
	onParticipantMenu?: (
		participant: GroupChatInfoParticipant,
		anchor: HTMLElement
	) => void;
	/** Accessible name for the overflow button of one participant. */
	participantMenuLabel?: (name: string) => string;
	onShowQrCode?: () => void;
	onCopyInviteLink?: () => void;
	teamRoles?: GroupChatInfoTeamMember[];
	/**
	 * Replaces the read-only `teamRoles` list with interactive content (the
	 * app passes `GroupChatRoleManager`). The section card and its heading
	 * stay; render nothing to hide the section.
	 */
	teamRolesSlot?: React.ReactNode;
	/** An extra action in the hero, e.g. "Chat beenden" while the room runs. */
	primaryAction?: React.ReactNode;
	settings: GroupChatInfoSetting[];
	onEdit?: () => void;
	onBack?: () => void;
	backLabel?: string;
}

const SETTING_ICONS: Record<GroupChatInfoSettingKey, React.ElementType> = {
	topic: LabelOutlinedIcon,
	date: EventOutlinedIcon,
	time: ScheduleOutlinedIcon,
	duration: TimerOutlinedIcon,
	repetition: RepeatRoundedIcon,
	agency: ApartmentOutlinedIcon,
	hint: ChatBubbleOutlineRoundedIcon,
	creator: PersonOutlineRoundedIcon,
	createDate: HistoryRoundedIcon
};

const initialsOf = (name: string) =>
	name
		.split(/[\s_.-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('');

// M3 type scale, spelled out once so every text in here uses the same steps.
const type = {
	titleLarge: { fontSize: 22, lineHeight: '28px', fontWeight: 400 },
	headlineSmall: { fontSize: 24, lineHeight: '32px', fontWeight: 400 },
	titleMedium: { fontSize: 16, lineHeight: '24px', fontWeight: 500 },
	bodyLarge: { fontSize: 16, lineHeight: '24px', fontWeight: 400 },
	bodyMedium: { fontSize: 14, lineHeight: '20px', fontWeight: 400 },
	labelMedium: {
		fontSize: 12,
		lineHeight: '16px',
		fontWeight: 500,
		letterSpacing: '0.5px'
	}
} as const;

const onSurface = 'var(--m3-on-surface)';
const onSurfaceVariant = 'var(--m3-on-surface-variant)';

const sectionCardSx: SxProps<Theme> = {
	bgcolor: 'var(--m3-surface-container-low)',
	borderRadius: '16px',
	py: 1,
	minWidth: 0
};

const sectionHeadSx: SxProps<Theme> = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	gap: 1,
	minHeight: 48,
	px: 2
};

const listItemSx: SxProps<Theme> = {
	px: 2,
	minHeight: 56
};

const avatarSx: SxProps<Theme> = {
	width: 40,
	height: 40,
	bgcolor: 'var(--m3-surface-container-highest)',
	color: 'var(--m3-on-surface-variant)',
	...type.titleMedium
};

const outlinedActionSx: SxProps<Theme> = {
	borderRadius: '20px',
	borderColor: 'var(--m3-outline)',
	color: 'var(--oriso-primary-text, var(--m3-primary))',
	textTransform: 'none',
	fontSize: 14,
	lineHeight: '20px',
	fontWeight: 500,
	px: 2,
	minHeight: 40
};

const SectionHeading = ({
	id,
	children,
	trailing
}: {
	id: string;
	children: React.ReactNode;
	trailing?: React.ReactNode;
}) => (
	<Box sx={sectionHeadSx}>
		<Typography
			id={id}
			component="h3"
			sx={{ ...type.titleMedium, color: onSurface, m: 0 }}
		>
			{children}
		</Typography>
		{trailing}
	</Box>
);

export const GroupChatInfoM3 = ({
	topic,
	scheduleSummary,
	statusLabel,
	active = false,
	calendarAction,
	participants,
	canModerate = false,
	onParticipantMenu,
	participantMenuLabel = (name) => `Optionen für ${name}`,
	onShowQrCode,
	onCopyInviteLink,
	teamRoles = [],
	teamRolesSlot,
	primaryAction,
	settings,
	onEdit,
	onBack,
	backLabel
}: GroupChatInfoM3Props) => {
	const { t: translate } = useTranslation();
	const baseId = useId().replace(/:/g, '');
	const ids = {
		title: `${baseId}-title`,
		participants: `${baseId}-participants`,
		roles: `${baseId}-roles`,
		settings: `${baseId}-settings`
	};

	return (
		<Box
			component="section"
			aria-labelledby={ids.title}
			data-testid="group-chat-info-m3"
			sx={{
				display: 'flex',
				flexDirection: 'column',
				flex: 1,
				minHeight: 0,
				height: '100%',
				bgcolor: 'var(--m3-surface-container-lowest)',
				color: onSurface,
				containerType: 'inline-size'
			}}
		>
			{/* M3 small top app bar */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 0.5,
					minHeight: 64,
					px: 1,
					borderBottom: '1px solid var(--m3-outline-variant)',
					flex: '0 0 auto'
				}}
			>
				{onBack && (
					<IconButton
						onClick={onBack}
						aria-label={backLabel ?? translate('app.back')}
						sx={{ color: onSurfaceVariant }}
					>
						<ArrowBackRoundedIcon />
					</IconButton>
				)}
				<Box sx={{ minWidth: 0, pl: onBack ? 0.5 : 1.5 }}>
					<Typography
						id={ids.title}
						component="h2"
						sx={{ ...type.titleLarge, color: onSurface, m: 0 }}
					>
						{translate('groupChat.info.headline')}
					</Typography>
				</Box>
			</Box>

			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					overflowY: 'auto',
					px: { xs: 2, lg: 3 },
					py: 3
				}}
			>
				<Box sx={{ maxWidth: 960, mx: 'auto' }}>
					{/* Hero: who this room is and when it meets */}
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 2,
							flexWrap: 'wrap',
							mb: 3
						}}
					>
						<Avatar
							sx={{
								width: 56,
								height: 56,
								bgcolor: 'var(--m3-primary-fixed)',
								color: 'var(--m3-on-primary-fixed-variant)'
							}}
						>
							<ForumOutlinedIcon aria-hidden="true" />
						</Avatar>
						<Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
							<Typography
								component="p"
								sx={{
									...type.headlineSmall,
									color: onSurface,
									m: 0,
									overflowWrap: 'anywhere'
								}}
							>
								{topic}
							</Typography>
							{(scheduleSummary || statusLabel) && (
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										flexWrap: 'wrap',
										gap: 1,
										mt: 0.5
									}}
								>
									{statusLabel && (
										<Chip
											size="small"
											label={statusLabel}
											sx={{
												height: 24,
												borderRadius: '8px',
												...type.labelMedium,
												border: '1px solid',
												borderColor: active
													? 'transparent'
													: 'var(--m3-outline-variant)',
												bgcolor: active
													? 'var(--m3-primary-fixed)'
													: 'transparent',
												color: active
													? 'var(--m3-on-primary-fixed-variant)'
													: 'var(--m3-on-surface-variant)'
											}}
										/>
									)}
									{scheduleSummary && (
										<Typography
											component="span"
											sx={{
												...type.bodyMedium,
												color: onSurfaceVariant
											}}
										>
											{scheduleSummary}
										</Typography>
									)}
								</Box>
							)}
						</Box>
						{(calendarAction || primaryAction) && (
							<Box
								sx={{
									'flex': '0 0 auto',
									'display': 'flex',
									'flexWrap': 'wrap',
									'gap': 1,
									'@container (max-width: 559px)': {
										flexBasis: '100%'
									}
								}}
							>
								{primaryAction}
								{calendarAction}
							</Box>
						)}
					</Box>

					<Box
						sx={{
							'display': 'grid',
							'gap': 2,
							'gridTemplateColumns': 'minmax(0, 1fr)',
							'alignItems': 'start',
							'@container (min-width: 720px)': {
								gridTemplateColumns:
									'minmax(0, 1fr) minmax(0, 1fr)'
							}
						}}
					>
						<Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
							{/* Participants */}
							<Box
								component="section"
								aria-labelledby={ids.participants}
								sx={sectionCardSx}
							>
								<SectionHeading
									id={ids.participants}
									trailing={
										<Typography
											component="span"
											sx={{
												...type.labelMedium,
												color: onSurfaceVariant
											}}
										>
											{participants.length}
										</Typography>
									}
								>
									{translate(
										'groupChat.info.subscribers.headline'
									)}
								</SectionHeading>
								{(onShowQrCode || onCopyInviteLink) && (
									<Box
										sx={{
											display: 'flex',
											flexWrap: 'wrap',
											gap: 1,
											px: 2,
											pb: 1
										}}
									>
										{onShowQrCode && (
											<Button
												variant="outlined"
												startIcon={
													<QrCode2RoundedIcon />
												}
												onClick={onShowQrCode}
												sx={outlinedActionSx}
											>
												{translate('qrCode.link.text')}
											</Button>
										)}
										{onCopyInviteLink && (
											<Button
												variant="outlined"
												startIcon={
													<ContentCopyRoundedIcon />
												}
												onClick={onCopyInviteLink}
												sx={outlinedActionSx}
											>
												{translate(
													'groupChat.copy.link.text'
												)}
											</Button>
										)}
									</Box>
								)}
								{participants.length === 0 ? (
									<Typography
										sx={{
											...type.bodyMedium,
											color: onSurfaceVariant,
											px: 2,
											py: 1.5
										}}
									>
										{translate(
											'groupChat.info.subscribers.empty'
										)}
									</Typography>
								) : (
									<List disablePadding>
										{participants.map((participant) => (
											<ListItem
												key={participant.id}
												sx={listItemSx}
												secondaryAction={
													canModerate &&
													!participant.isModerator &&
													!participant.statusLabel ? (
														<IconButton
															edge="end"
															aria-label={participantMenuLabel(
																participant.name
															)}
															onClick={(event) =>
																onParticipantMenu?.(
																	participant,
																	event.currentTarget
																)
															}
															sx={{
																color: onSurfaceVariant
															}}
														>
															<MoreVertRoundedIcon />
														</IconButton>
													) : undefined
												}
											>
												<ListItemAvatar>
													<Avatar
														sx={avatarSx}
														aria-hidden="true"
													>
														{initialsOf(
															participant.name
														)}
													</Avatar>
												</ListItemAvatar>
												<ListItemText
													primary={participant.name}
													secondary={
														participant.statusLabel
													}
													secondaryTypographyProps={{
														sx: {
															...type.labelMedium,
															color: 'var(--m3-error)'
														}
													}}
													primaryTypographyProps={{
														sx: {
															...type.bodyLarge,
															color: onSurface,
															overflowWrap:
																'anywhere'
														}
													}}
												/>
											</ListItem>
										))}
									</List>
								)}
							</Box>

							{/* Team roles */}
							{(teamRolesSlot ?? teamRoles.length > 0) && (
								<Box
									component="section"
									aria-labelledby={ids.roles}
									sx={sectionCardSx}
								>
									<SectionHeading id={ids.roles}>
										{translate('groupChat.roles.headline')}
									</SectionHeading>
									{teamRolesSlot ?? (
										<List disablePadding>
											{teamRoles.map((member) => (
												<ListItem
													key={member.id}
													sx={listItemSx}
												>
													<ListItemAvatar>
														<Avatar
															sx={avatarSx}
															aria-hidden="true"
														>
															{initialsOf(
																member.name
															)}
														</Avatar>
													</ListItemAvatar>
													<ListItemText
														primary={member.name}
														secondary={translate(
															`groupChat.roles.${member.role}`
														)}
														primaryTypographyProps={{
															sx: {
																...type.bodyLarge,
																color: onSurface,
																overflowWrap:
																	'anywhere'
															}
														}}
														secondaryTypographyProps={{
															sx: {
																...type.bodyMedium,
																color: onSurfaceVariant
															}
														}}
													/>
												</ListItem>
											))}
										</List>
									)}
								</Box>
							)}
						</Box>

						{/* Room settings */}
						<Box
							component="section"
							aria-labelledby={ids.settings}
							sx={sectionCardSx}
						>
							<SectionHeading
								id={ids.settings}
								trailing={
									onEdit ? (
										<Button
											variant="text"
											startIcon={<EditOutlinedIcon />}
											onClick={onEdit}
											sx={{
												...outlinedActionSx,
												px: 1.5,
												mr: -1
											}}
										>
											{translate(
												'groupChat.info.settings.edit'
											)}
										</Button>
									) : undefined
								}
							>
								{translate('groupChat.info.settings.headline')}
							</SectionHeading>
							<List disablePadding>
								{settings.map((setting) => {
									const Icon = SETTING_ICONS[setting.key];
									return (
										<ListItem
											key={setting.key}
											sx={{
												...listItemSx,
												alignItems: 'flex-start'
											}}
										>
											<ListItemIcon
												sx={{
													minWidth: 40,
													mt: 1,
													color: onSurfaceVariant
												}}
											>
												<Icon aria-hidden="true" />
											</ListItemIcon>
											<ListItemText
												primary={setting.label}
												secondary={setting.value || '–'}
												primaryTypographyProps={{
													sx: {
														...type.labelMedium,
														color: onSurfaceVariant
													}
												}}
												secondaryTypographyProps={{
													sx: {
														...type.bodyLarge,
														color: onSurface,
														overflowWrap:
															'anywhere',
														whiteSpace: 'pre-line'
													}
												}}
												sx={{ my: 0.75 }}
											/>
										</ListItem>
									);
								})}
							</List>
						</Box>
					</Box>
				</Box>
			</Box>
		</Box>
	);
};
