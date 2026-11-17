/**
 * PROTOTYPE, Storybook only (Frank *19, 2026-11-17): "Sprechzeiten" —
 * time windows in which bookings through a link are accepted on their own
 * (auto-accept), the counterpart to Sperrzeiten. Plus the extra list of
 * links that book into those windows. No API, no i18n yet: this answers
 * "does this feel right?" before anything is wired.
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import {
	Box,
	Button,
	Checkbox,
	Chip,
	FormControlLabel,
	IconButton,
	MenuItem,
	Stack,
	Switch,
	TextField,
	Tooltip,
	Typography
} from '@mui/material';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { DirectLinkShareDialog } from '../../conversationCreate/directLink/DirectLinkShareDialog';
import type { DirectLink } from '../../conversationCreate/directLink/directLink';

export type OfficeMedium = 'video' | 'phone' | 'chat' | 'onsite';

export interface OfficeWindow {
	id: string;
	/** 0 = Monday … 6 = Sunday. */
	weekday: number;
	from: string;
	to: string;
	media: OfficeMedium[];
}

export interface AutoAcceptLink {
	id: string;
	name: string;
	/** The windows this link books into. */
	windowIds: string[];
	slotMinutes: number;
	active: boolean;
	url: string;
}

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MEDIUM_LABEL: Record<OfficeMedium, string> = {
	video: 'Video',
	phone: 'Telefon',
	chat: 'Chat',
	onsite: 'Vor Ort'
};
const DAY_START = 8;
const DAY_END = 20;

const toHours = (time: string) => {
	const [h, m] = time.split(':').map(Number);
	return h + m / 60;
};

export const windowLabel = (w: OfficeWindow) =>
	`${WEEKDAYS[w.weekday]} ${w.from}–${w.to}`;

/** How many bookable slots a week of these windows holds. */
export const slotsPerWeek = (windows: OfficeWindow[], slotMinutes: number) =>
	windows.reduce(
		(sum, w) =>
			sum +
			Math.max(
				0,
				Math.floor(
					((toHours(w.to) - toHours(w.from)) * 60) / slotMinutes
				)
			),
		0
	);

const WeekStrip = ({ windows }: { windows: OfficeWindow[] }) => (
	<Box
		data-cy="office-hours-week"
		role="img"
		aria-label={`Sprechzeiten in der Woche: ${
			windows.map(windowLabel).join(', ') || 'keine'
		}`}
		sx={{
			display: 'grid',
			gridTemplateColumns: '28px 1fr',
			rowGap: '6px',
			columnGap: '8px',
			alignItems: 'center'
		}}
	>
		{WEEKDAYS.map((day, index) => (
			<React.Fragment key={day}>
				<Typography variant="caption" color="text.secondary">
					{day}
				</Typography>
				<Box
					sx={{
						position: 'relative',
						height: 14,
						borderRadius: '7px',
						bgcolor: 'action.hover'
					}}
				>
					{windows
						.filter((w) => w.weekday === index)
						.map((w) => {
							const left =
								((toHours(w.from) - DAY_START) /
									(DAY_END - DAY_START)) *
								100;
							const width =
								((toHours(w.to) - toHours(w.from)) /
									(DAY_END - DAY_START)) *
								100;
							return (
								<Box
									key={w.id}
									sx={{
										position: 'absolute',
										top: 0,
										bottom: 0,
										left: `${Math.max(0, left)}%`,
										width: `${Math.max(0, width)}%`,
										borderRadius: '7px',
										bgcolor: '#2e7d32'
									}}
								/>
							);
						})}
				</Box>
			</React.Fragment>
		))}
		<span />
		<Stack direction="row" justifyContent="space-between">
			{[8, 11, 14, 17, 20].map((h) => (
				<Typography key={h} variant="caption" color="text.secondary">
					{h}:00
				</Typography>
			))}
		</Stack>
	</Box>
);

const NewWindowForm = ({
	onAdd
}: {
	onAdd: (w: Omit<OfficeWindow, 'id'>) => void;
}) => {
	const [weekday, setWeekday] = useState(0);
	const [from, setFrom] = useState('14:00');
	const [to, setTo] = useState('16:00');
	const [media, setMedia] = useState<OfficeMedium[]>(['video', 'phone']);
	const invalid = toHours(to) <= toHours(from) || media.length === 0;
	return (
		<Stack
			data-cy="office-hours-new"
			direction="row"
			flexWrap="wrap"
			gap={1.5}
			alignItems="center"
		>
			<TextField
				select
				size="small"
				label="Tag"
				value={weekday}
				onChange={(e) => setWeekday(Number(e.target.value))}
				sx={{ width: 90 }}
			>
				{WEEKDAYS.map((day, index) => (
					<MenuItem key={day} value={index}>
						{day}
					</MenuItem>
				))}
			</TextField>
			<TextField
				size="small"
				type="time"
				label="Von"
				value={from}
				onChange={(e) => setFrom(e.target.value)}
				sx={{ width: 120 }}
			/>
			<TextField
				size="small"
				type="time"
				label="Bis"
				value={to}
				onChange={(e) => setTo(e.target.value)}
				sx={{ width: 120 }}
			/>
			{(Object.keys(MEDIUM_LABEL) as OfficeMedium[]).map((m) => (
				<FormControlLabel
					key={m}
					control={
						<Checkbox
							size="small"
							checked={media.includes(m)}
							onChange={(e) =>
								setMedia((all) =>
									e.target.checked
										? [...all, m]
										: all.filter((x) => x !== m)
								)
							}
						/>
					}
					label={MEDIUM_LABEL[m]}
				/>
			))}
			<Button
				variant="contained"
				startIcon={<AddIcon />}
				disabled={invalid}
				onClick={() => onAdd({ weekday, from, to, media })}
			>
				Zeitfenster hinzufügen
			</Button>
		</Stack>
	);
};

export interface OfficeHoursPrototypeProps {
	initialWindows: OfficeWindow[];
	initialLinks: AutoAcceptLink[];
}

export const OfficeHoursPrototype = ({
	initialWindows,
	initialLinks
}: OfficeHoursPrototypeProps) => {
	const [windows, setWindows] = useState(initialWindows);
	const [links, setLinks] = useState(initialLinks);
	const [qr, setQr] = useState<AutoAcceptLink | null>(null);
	const [copied, setCopied] = useState<string | null>(null);
	const byId = useMemo(
		() => Object.fromEntries(windows.map((w) => [w.id, w])),
		[windows]
	);

	const qrLink: DirectLink | null = qr
		? {
				id: qr.id,
				name: qr.name,
				topic: '',
				medium: 'VIDEO',
				temporary: true,
				active: qr.active,
				url: qr.url
			}
		: null;

	return (
		<Stack gap={4} sx={{ maxWidth: 760, p: 3 }}>
			<Stack component="section" gap={2} aria-labelledby="oh-title">
				<div>
					<Typography id="oh-title" variant="h6" component="h2">
						Sprechzeiten
					</Typography>
					<Typography variant="body2" color="text.secondary">
						In diesen Zeitfenstern werden Termine, die über Ihre
						Sprechzeiten-Links gebucht werden, automatisch
						angenommen. Sperrzeiten gehen immer vor.
					</Typography>
				</div>
				<WeekStrip windows={windows} />
				<Stack
					component="ul"
					gap={1}
					sx={{ m: 0, p: 0, listStyle: 'none' }}
				>
					{windows.map((w) => (
						<Stack
							component="li"
							key={w.id}
							data-cy={`office-hours-window-${w.id}`}
							direction="row"
							alignItems="center"
							gap={1}
						>
							<Typography sx={{ minWidth: 130, fontWeight: 500 }}>
								{windowLabel(w)}
							</Typography>
							<Stack
								direction="row"
								gap={0.5}
								flexWrap="wrap"
								flex={1}
							>
								{w.media.map((m) => (
									<Chip
										key={m}
										size="small"
										label={MEDIUM_LABEL[m]}
									/>
								))}
							</Stack>
							<Tooltip title="Zeitfenster löschen">
								<IconButton
									aria-label={`Zeitfenster ${windowLabel(w)} löschen`}
									onClick={() => {
										setWindows((all) =>
											all.filter((x) => x.id !== w.id)
										);
										setLinks((all) =>
											all.map((l) => ({
												...l,
												windowIds: l.windowIds.filter(
													(id) => id !== w.id
												)
											}))
										);
									}}
								>
									<DeleteOutlineIcon />
								</IconButton>
							</Tooltip>
						</Stack>
					))}
				</Stack>
				<NewWindowForm
					onAdd={(w) =>
						setWindows((all) => [
							...all,
							{ ...w, id: `w${Date.now().toString(36)}` }
						])
					}
				/>
			</Stack>

			<Stack component="section" gap={2} aria-labelledby="oh-links-title">
				<div>
					<Typography id="oh-links-title" variant="h6" component="h2">
						Links mit Sprechzeiten
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Wer einen dieser Links öffnet, wählt einen freien Termin
						in den Sprechzeiten. Sie müssen ihn nicht mehr
						bestätigen.
					</Typography>
				</div>
				<Stack
					component="ul"
					gap={1.5}
					sx={{ m: 0, p: 0, listStyle: 'none' }}
				>
					{links.map((link) => {
						const linkWindows = link.windowIds
							.map((id) => byId[id])
							.filter(Boolean);
						return (
							<Stack
								component="li"
								key={link.id}
								data-cy={`office-hours-link-${link.id}`}
								direction="row"
								alignItems="center"
								gap={1}
								sx={{
									p: 1.5,
									borderRadius: 2,
									border: 1,
									borderColor: 'divider'
								}}
							>
								<Box flex={1} minWidth={0}>
									<Typography sx={{ fontWeight: 500 }}>
										{link.name}
									</Typography>
									<Typography
										variant="body2"
										color="text.secondary"
									>
										{linkWindows.length
											? linkWindows
													.map(windowLabel)
													.join(' · ')
											: 'Keine Sprechzeit gewählt'}
										{' · '}
										{link.slotMinutes} Min. ·{' '}
										{slotsPerWeek(
											linkWindows,
											link.slotMinutes
										)}{' '}
										freie Termine pro Woche
									</Typography>
									{copied === link.id && (
										<Typography
											variant="caption"
											role="status"
										>
											Link kopiert
										</Typography>
									)}
								</Box>
								<Tooltip title="Link kopieren">
									<IconButton
										aria-label={`Link „${link.name}“ kopieren`}
										onClick={() => {
											navigator.clipboard
												?.writeText(link.url)
												.catch(() => undefined);
											setCopied(link.id);
										}}
									>
										<ContentCopyOutlinedIcon />
									</IconButton>
								</Tooltip>
								<Tooltip title="QR-Code zeigen">
									<IconButton
										aria-label={`QR-Code für „${link.name}“ zeigen`}
										onClick={() => setQr(link)}
									>
										<QrCode2OutlinedIcon />
									</IconButton>
								</Tooltip>
								<Switch
									checked={link.active}
									inputProps={{
										'aria-label': `„${link.name}“ aktiv`
									}}
									onChange={(e) =>
										setLinks((all) =>
											all.map((l) =>
												l.id === link.id
													? {
															...l,
															active: e.target
																.checked
														}
													: l
											)
										)
									}
								/>
							</Stack>
						);
					})}
				</Stack>
			</Stack>
			{qrLink && (
				<DirectLinkShareDialog
					open
					link={qrLink}
					onClose={() => setQr(null)}
				/>
			)}
		</Stack>
	);
};
