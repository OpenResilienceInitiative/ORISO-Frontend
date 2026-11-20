/**
 * A click on a grey colleague band ("2 von 4 belegt") opens this card:
 * who is busy with what, who is free, each colleague's calendar side by
 * side, a move proposal where UserService takes one, and one's own entry
 * at that time (Frank *16.2, 2026-11-17).
 *
 * On a wide screen it takes the place of the list in the left column,
 * which has room for five or six people; in full screen, next to the
 * narrow rail and on the phone it opens at the band (`variant="menu"`,
 * inside the calendar's menu card).
 *
 * Nobody may change a colleague's entry directly: UserService sends them
 * with `movable: false` and knows no "edit rights". An appointment takes
 * a proposal the colleague accepts; a Sperrzeit only its owner changes.
 */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import {
	ChatMenuDropdown,
	ChatMenuDropdownDivider,
	ChatMenuDropdownGroupLabel,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem,
	ChatMenuDropdownNote
} from '../chatMenuDropdown/ChatMenuDropdown';
import type { ColleagueBand } from './calendarBands';
import type { CalendarEntry, Colleague } from './calendarModel';
import { CalendarEntryGlyph } from './CalendarEntryGlyph';
import { initialsOf } from './CalendarEntryPeek';
import { avatarToneClass } from './calendarAvatar';
import { calendarLocale } from './calendarLocale';
import { useEntryKindLabel, useRangeFormat } from './useEntryLabel';

export interface BandCardBusy {
	colleague: Colleague;
	/** What keeps them busy in the band, earliest first. */
	entries: CalendarEntry[];
}

/** `move`: one's own co-access copy; `propose`: the colleague decides. */
export type BandMoveAction = 'move' | 'propose' | null;

export interface CalendarBandCardProps {
	band: ColleagueBand;
	busy: BandCardBusy[];
	/** Shown colleagues free in the whole band. */
	free: Colleague[];
	/** "Wird geladen: …" or "Nicht geladen: …", already translated. */
	unknownNote?: string;
	moveActionOf: (entry: CalendarEntry) => BandMoveAction;
	/** A colleague's id, or `null` for everyone side by side. */
	onShowCalendar: (colleagueId: string | null) => void;
	onMoveEntry: (entry: CalendarEntry, anchor: HTMLElement) => void;
	/** "Zu dieser Zeit eintragen"; left out, the item is not offered. */
	onCreate?: (anchor: HTMLElement) => void;
	onClose: () => void;
	/** `side`: in place of the list; `menu`: in the menu at the band. */
	variant: 'side' | 'menu';
}

const Avatar = ({ name }: { name: string }) => (
	<span
		className={`calendarBandCard__avatar ${avatarToneClass(name)}`}
		aria-hidden="true"
	>
		{initialsOf(name)}
	</span>
);

export const CalendarBandCard = ({
	band,
	busy,
	free,
	unknownNote,
	moveActionOf,
	onShowCalendar,
	onMoveEntry,
	onCreate,
	onClose,
	variant
}: CalendarBandCardProps) => {
	const { t, i18n } = useTranslation();
	const format = useRangeFormat();
	const kindLabel = useEntryKindLabel();
	const clock = new Intl.DateTimeFormat(calendarLocale(i18n.language), {
		hour: '2-digit',
		minute: '2-digit'
	});
	const sameDay = (a: Date, b: Date) =>
		a.toDateString() === new Date(b.getTime() - 1).toDateString();
	/** The band names the day; an entry names its own clock times. */
	const when = (entry: CalendarEntry) => {
		if (entry.allDay) return t('calendar.allDay');
		const start = new Date(entry.start);
		const end = new Date(entry.end);
		return sameDay(start, end)
			? `${clock.format(start)}–${clock.format(end)}`
			: format(start, end);
	};
	const total = busy.length + free.length;
	const title =
		total === 1 && busy[0]
			? t('calendar.bandOne', { name: busy[0].colleague.displayName })
			: t('calendar.bandSome', { busy: busy.length, total });

	const cardRef = useRef<HTMLDivElement>(null);
	// In the side column the card takes the list's place: focus follows,
	// so the keyboard and a screen reader land on it. A newly clicked band
	// moves it there again. The menu at the band focuses itself.
	const key = `${band.start.getTime()}-${band.end.getTime()}`;
	useEffect(() => {
		if (variant === 'side') cardRef.current?.focus();
	}, [variant, key]);

	const content = (
		<div
			ref={cardRef}
			className="calendarBandCard"
			tabIndex={variant === 'side' ? -1 : undefined}
			onKeyDown={
				variant === 'side'
					? (event) => {
							if (event.key !== 'Escape') return;
							event.stopPropagation();
							onClose();
						}
					: undefined
			}
			data-testid="calendar-band-card"
			data-cy="calendar-band-card"
		>
			<div className="calendarBandCard__head">
				{variant === 'side' && (
					<IconButton
						size="small"
						onClick={onClose}
						aria-label={t('calendar.bandCard.back')}
						data-cy="calendar-band-card-back"
					>
						<ArrowBackIcon fontSize="small" />
					</IconButton>
				)}
				<ChatMenuDropdownHeader
					subtitle={format(band.start, band.end)}
					title={title}
				/>
			</div>

			<ChatMenuDropdownGroupLabel>
				{t('calendar.bandCard.busy')}
			</ChatMenuDropdownGroupLabel>
			<ul className="calendarBandCard__people">
				{busy.map(({ colleague, entries }) => {
					const name = colleague.displayName;
					const actions = entries
						.map((entry) => ({
							entry,
							action: moveActionOf(entry)
						}))
						.filter(({ action }) => action);
					return (
						<li
							key={colleague.id}
							className="calendarBandCard__person"
							data-testid={`calendar-band-person-${colleague.id}`}
						>
							<p className="calendarBandCard__who">
								<Avatar name={name} />
								<span className="calendarBandCard__name">
									{name}
								</span>
								{colleague.agencyShort && (
									<span
										className="calendarBandCard__agency"
										title={colleague.agencyName}
									>
										{colleague.agencyShort}
									</span>
								)}
							</p>
							<ul className="calendarBandCard__entries">
								{entries.map((entry) => (
									<li
										key={entry.id}
										className="calendarBandCard__entry"
									>
										<span
											className="calendarBandCard__glyph"
											aria-hidden="true"
										>
											<CalendarEntryGlyph
												entry={entry}
												colleague
											/>
										</span>
										<span>
											{`${kindLabel(entry)} · ${when(entry)}`}
											{/* The advice seeker only where the
											    colleague's Träger allows it. */}
											{entry.type === 'appointment' &&
												entry.title && (
													<span className="calendarBandCard__title">
														{entry.title}
													</span>
												)}
										</span>
									</li>
								))}
							</ul>
							<div className="calendarBandCard__actions">
								<ChatMenuDropdownItem
									icon={<ViewColumnIcon />}
									title={t('calendar.bandCard.show')}
									aria-label={t(
										'calendar.bandCard.showLabel',
										{
											name
										}
									)}
									onClick={() => onShowCalendar(colleague.id)}
									data-cy={`calendar-band-show-${colleague.id}`}
								/>
								{actions.map(({ entry, action }) => (
									<ChatMenuDropdownItem
										key={entry.id}
										icon={<EventRepeatOutlinedIcon />}
										title={
											action === 'move'
												? t('calendar.entryMenu.move')
												: t(
														'calendar.entryMenu.propose'
													)
										}
										description={
											actions.length > 1
												? when(entry)
												: action === 'propose'
													? t(
															'calendar.entryMenu.proposeSub',
															{ name }
														)
													: undefined
										}
										onClick={(
											event: React.MouseEvent<HTMLElement>
										) =>
											onMoveEntry(
												entry,
												event.currentTarget
											)
										}
										data-cy={`calendar-band-move-${entry.id}`}
									/>
								))}
							</div>
							{actions.length === 0 && (
								<ChatMenuDropdownNote>
									{t('calendar.bandCard.ownerOnly', { name })}
								</ChatMenuDropdownNote>
							)}
						</li>
					);
				})}
			</ul>

			{total > 1 && (
				<div
					className="calendarBandCard__free"
					data-testid="calendar-band-free"
				>
					<ChatMenuDropdownGroupLabel>
						{t('calendar.bandCard.free')}
					</ChatMenuDropdownGroupLabel>
					{free.length > 0 ? (
						<ul className="calendarBandCard__chips">
							{free.map((colleague) => (
								<li
									key={colleague.id}
									className="calendarBandCard__chip"
								>
									<Avatar name={colleague.displayName} />
									{colleague.displayName}
								</li>
							))}
						</ul>
					) : (
						<ChatMenuDropdownNote>
							{t('calendar.bandCard.nobodyFree')}
						</ChatMenuDropdownNote>
					)}
				</div>
			)}
			{unknownNote && (
				<ChatMenuDropdownNote>{unknownNote}</ChatMenuDropdownNote>
			)}

			<ChatMenuDropdownDivider className="calendarBandCard__divider" />
			<ChatMenuDropdownItem
				icon={<ViewColumnIcon />}
				title={t('calendar.bandCard.all')}
				onClick={() => onShowCalendar(null)}
				data-cy="calendar-band-all"
			/>
			{onCreate && (
				<ChatMenuDropdownItem
					icon={<AddIcon />}
					title={t('calendar.bandCard.create')}
					description={`${clock.format(band.start)}–${clock.format(band.end)}`}
					onClick={(event: React.MouseEvent<HTMLElement>) =>
						onCreate(event.currentTarget)
					}
					data-cy="calendar-band-create"
				/>
			)}
		</div>
	);

	if (variant === 'menu') return content;
	return (
		<ChatMenuDropdown
			density="compact"
			role="dialog"
			ariaLabel={t('calendar.bandCard.label')}
			className="calendarBandCard__frame"
		>
			{content}
		</ChatMenuDropdown>
	);
};
