/**
 * One planned appointment above "Jetzt" (ADR-021): a quiet pill, so the future
 * never looks like a chat card. A click opens the room; the appointment menu
 * sits on a long press (touch), the context menu and, inside the room, the
 * split button below its header. Without a room a click opens the menu.
 */
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useGroupCardMembers } from '../../../hooks/useGroupCardMembers';
import { ReactComponent as PeopleIcon } from '../../../resources/img/icons/groups.svg';
import { MODALITY_ICON } from './AppointmentKindGlyph';
import { UnreadFilterIcon } from '../SessionToolbarFilterIcons';
import { normalizeTimelineLocale } from '../futureTimelineTime';
import { EntryMenu, type AppointmentAction } from './AppointmentSplitButton';
import {
	entryCountdown,
	formatEntryRange,
	type FutureEntry,
	type TimelineRole
} from './timelineModel';

const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP_PX = 8;

export interface FutureEntryPillProps {
	entry: FutureEntry;
	role: TimelineRole;
	now: Date;
	selected?: boolean;
	unread?: boolean;
	onOpen?: (entry: FutureEntry) => void;
	onAction?: AppointmentAction;
}

export const FutureEntryPill = ({
	entry,
	role,
	now,
	selected = false,
	unread = false,
	onOpen,
	onAction
}: FutureEntryPillProps) => {
	const { t, i18n } = useTranslation();
	const locale = normalizeTimelineLocale(
		i18n.resolvedLanguage,
		i18n.language
	);
	const { status, members } = useGroupCardMembers(
		entry.matrixRoomId,
		Boolean(entry.matrixRoomId)
	);
	const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
	const pillRef = useRef<HTMLButtonElement>(null);
	const pressRef = useRef<{ x: number; y: number; timer: number } | null>(
		null
	);
	// The click that ends a long press must not also open the room.
	const swallowClickRef = useRef(false);

	const openMenu = useCallback(() => {
		const rect = pillRef.current?.getBoundingClientRect();
		if (rect) setMenuAnchor(rect);
	}, []);
	const cancelPress = useCallback(() => {
		if (pressRef.current) window.clearTimeout(pressRef.current.timer);
		pressRef.current = null;
	}, []);
	useEffect(() => cancelPress, [cancelPress]);

	const countdown = entryCountdown(entry, now, locale);
	const when = countdown.running
		? t('sessionList.timeline.running')
		: countdown.label;
	const people =
		entry.kind === 'group' && status === 'ready' ? members.length : 0;
	const peopleLabel = t('groupCardParticipants.memberCount', {
		count: people
	});
	const Icon = MODALITY_ICON[entry.modality];

	return (
		<>
			<button
				ref={pillRef}
				type="button"
				className={clsx(
					'tlp__entry',
					countdown.soon && 'tlp__entry--soon',
					selected && 'tlp__entry--selected'
				)}
				data-cy="timeline-entry"
				data-unmapped={
					entry.sessionId === undefined ? 'true' : undefined
				}
				aria-current={selected ? 'true' : undefined}
				onClick={() => {
					if (swallowClickRef.current) {
						swallowClickRef.current = false;
						return;
					}
					if (entry.sessionId === undefined) openMenu();
					else onOpen?.(entry);
				}}
				onContextMenu={(e) => {
					e.preventDefault();
					openMenu();
				}}
				onPointerDown={(e) => {
					if (e.pointerType !== 'touch') return;
					pressRef.current = {
						x: e.clientX,
						y: e.clientY,
						timer: window.setTimeout(() => {
							swallowClickRef.current = true;
							openMenu();
						}, LONG_PRESS_MS)
					};
				}}
				onPointerMove={(e) => {
					const press = pressRef.current;
					if (
						press &&
						Math.hypot(e.clientX - press.x, e.clientY - press.y) >
							LONG_PRESS_SLOP_PX
					)
						cancelPress();
				}}
				onPointerUp={cancelPress}
				onPointerCancel={cancelPress}
			>
				<Icon
					className="tlp__entryIcon"
					aria-hidden="true"
					focusable="false"
				/>
				<span className="tlp__entryText">
					<span className="tlp__entryTime">
						{formatEntryRange(entry, now, locale)}
					</span>
					<span className="tlp__entryTitle">{entry.title}</span>
				</span>
				{unread && (
					<span
						className="tlp__entryUnread"
						role="img"
						aria-label={t('sessionList.toolbar.chips.unread')}
						data-cy="timeline-entry-unread"
					>
						<UnreadFilterIcon hasIndicator />
					</span>
				)}
				{people > 0 && (
					<span
						className="tlp__entryPeople"
						role="img"
						aria-label={peopleLabel}
						title={peopleLabel}
						data-cy="timeline-entry-people"
					>
						<PeopleIcon aria-hidden="true" focusable="false" />
						{people}
					</span>
				)}
				<span className="tlp__entryWhen" data-cy="timeline-entry-when">
					{when}
				</span>
			</button>
			{menuAnchor && (
				<EntryMenu
					entry={entry}
					role={role}
					anchor={menuAnchor}
					onClose={() => setMenuAnchor(null)}
					onAction={onAction}
				/>
			)}
		</>
	);
};
