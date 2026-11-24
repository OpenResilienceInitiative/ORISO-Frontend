/**
 * A room's appointment as a pennant hanging from the header divider, beside
 * the topic tag (FE#2494, Frank 2026-11-24: "ein ähnlicher Wimpel wie das
 * Thema, ein Ticken größer … das Terminicon wie ein kleiner Boppel, der
 * rausguckt … hinten dran auch noch ein Boppel"). It replaces the grey
 * split button that lay below the header: far less height, fits the phone.
 *
 * Front: a round bubble with the Art (video, phone, place, chat). Middle:
 * the date. Back: a round bubble with the arrow. The whole pennant opens the
 * appointment menu (ADR-021: inside the room there is nothing to open).
 */
import * as React from 'react';
import { useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import './appointmentPennant.styles.scss';
import { ReactComponent as ArrowDownIcon } from '../../../resources/img/icons/keyboard_arrow_down.svg';
import { ReactComponent as PersonIcon } from '../../../resources/img/icons/person.svg';
import { ReactComponent as SupervisionIcon } from '../../../resources/img/icons/supervision_nocirc_400_24px.svg';
import { normalizeTimelineLocale } from '../futureTimelineTime';
import { MODALITY_ICON } from './AppointmentKindGlyph';
import {
	EntryMenu,
	type AppointmentAction,
	type MenuAnchor
} from './AppointmentSplitButton';
import {
	formatEntrySlot,
	type FutureEntry,
	type TimelineRole
} from './timelineModel';

export interface AppointmentPennantProps {
	entry: FutureEntry;
	role: TimelineRole;
	/**
	 * Who the appointment is with, when the room holds more than one kind,
	 * e.g. "Supervision". Absent: the room's own appointment.
	 */
	withLabel?: string;
	/**
	 * Who it is with, shown as an icon on the phone where the words do not
	 * fit (Frank, 2026-11-24). Absent: the room has only one kind.
	 */
	withKind?: 'asker' | 'supervisor';
	onAction?: AppointmentAction;
}

const WITH_ICON = { asker: PersonIcon, supervisor: SupervisionIcon };

export const AppointmentPennant = ({
	entry,
	role,
	withLabel,
	withKind,
	onAction
}: AppointmentPennantProps) => {
	const WithIcon = withKind ? WITH_ICON[withKind] : undefined;
	const { t, i18n } = useTranslation();
	const locale = normalizeTimelineLocale(
		i18n.resolvedLanguage,
		i18n.language
	);
	const slot = formatEntrySlot(entry, locale);
	// Phone: weekday and start only ("Di 14:30"); the menu has the rest.
	const short = `${entry.start.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')} ${entry.start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
	// FE#2287: the state first, so a cut label still says "angefragt".
	// On screen the icon says who it is with; the screen reader hears it.
	const label = [
		entry.requested && t('sessionList.timeline.appointment.request.marker'),
		slot
	]
		.filter(Boolean)
		.join(' · ');
	const spoken = [withLabel, label].filter(Boolean).join(' · ');
	const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
	const ref = useRef<HTMLButtonElement | null>(null);
	const menuId = useId();
	const Icon = MODALITY_ICON[entry.modality];
	const toggle = () => {
		const box = ref.current?.getBoundingClientRect();
		if (anchor || !box) {
			setAnchor(null);
			return;
		}
		setAnchor({ top: box.top, bottom: box.bottom, right: box.right });
	};

	return (
		<>
			<button
				ref={ref}
				type="button"
				className={clsx(
					'appointmentPennant',
					entry.requested && 'appointmentPennant--requested',
					withLabel && 'appointmentPennant--other'
				)}
				aria-haspopup="menu"
				aria-expanded={Boolean(anchor)}
				aria-controls={anchor ? menuId : undefined}
				aria-label={`${t('sessionList.timeline.appointment.menu', 'Terminmenü')}: ${spoken}`}
				onClick={toggle}
				data-cy="room-appointment-pennant"
			>
				<span className="appointmentPennant__bubble" aria-hidden>
					<Icon />
				</span>
				<span className="appointmentPennant__label">
					{WithIcon && (
						<WithIcon className="appointmentPennant__with" />
					)}
					<span className="appointmentPennant__text">{label}</span>
				</span>
				<span
					className="appointmentPennant__label appointmentPennant__label--short"
					aria-hidden
				>
					{WithIcon && (
						<WithIcon className="appointmentPennant__with" />
					)}
					{short}
				</span>
				<span
					className="appointmentPennant__bubble appointmentPennant__bubble--arrow"
					aria-hidden
				>
					<ArrowDownIcon />
				</span>
			</button>
			{anchor && (
				<EntryMenu
					id={menuId}
					entry={entry}
					role={role}
					anchor={anchor}
					opener={ref}
					onClose={() => setAnchor(null)}
					onAction={onAction}
				/>
			)}
		</>
	);
};
