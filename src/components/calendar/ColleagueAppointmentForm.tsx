/**
 * "Termin" with a colleague instead of an advice seeker (FE#2305, Frank
 * 2026-11-17: "Was ist, wenn ich einfach mit einem Kollegen sprechen
 * will?"). "Neuer Eintrag" switches to this form with "Ratsuchende Person |
 * Kolleg:in"; the advice-seeker side stays the shared invitation form.
 *
 * UserService opens (or reuses) the private internal chat of the two. Where
 * the Träger allows no internal chat with that colleague, only "Vor Ort" is
 * offered ("dann zeigst du halt einfach nur einen Vor-Ort-Termin an").
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { OrisoCalendar } from '../form/OrisoCalendar';
import { OrisoTimePicker } from '../form/OrisoTimePicker';
import { OrisoSelect } from '../form/OrisoSelect';
import { AppointmentKindTiles } from './AppointmentKindTiles';
import { FacetIcon } from './CalendarEntryGlyph';
import type { AppointmentFormProps, DialogForm } from './dialogForm';
import {
	daySpan,
	draftError,
	findConflicts,
	isWholeDays,
	APPOINTMENT_KINDS,
	type AppointmentDraft,
	type AppointmentKind,
	type Colleague
} from './calendarModel';
import { useDayLabels, useEntryLabel, useRangeFormat } from './useEntryLabel';

const join = (day: Dayjs | null, time: Dayjs | null) =>
	day && time
		? day.hour(time.hour()).minute(time.minute()).second(0).millisecond(0)
		: null;

const ONSITE_ONLY: AppointmentKind[] = ['onsite'];

export interface ColleagueAppointmentFormProps
	extends Omit<AppointmentFormProps, 'conversations' | 'initialSessionId'> {
	/** The calendar's colleague list (calendar reach). */
	colleagues: Colleague[];
	/**
	 * FE#2494: the colleague is given, e.g. the supervisor of a Supervision
	 * room. The form shows the name instead of the choice.
	 */
	fixedColleague?: { id: string; displayName: string };
	/** Says who the fixed colleague is, e.g. "Supervisor:in". */
	fixedColleagueLabel?: string;
	/**
	 * The kinds offered; all four unless narrowed, e.g. by the call gates of
	 * the Supervision chat (product owner, 2026-11-25). The default kind is
	 * the first of them.
	 */
	kinds?: readonly AppointmentKind[];
}

export const useColleagueAppointmentForm = ({
	slot,
	colleagues,
	fixedColleague,
	fixedColleagueLabel,
	kinds: offeredKinds = APPOINTMENT_KINDS,
	entries,
	ownerId,
	now,
	onSave,
	onClose
}: ColleagueAppointmentFormProps): DialogForm => {
	const dayLabels = useDayLabels();
	const { t } = useTranslation();
	const format = useRangeFormat();
	const label = useEntryLabel();
	// A month selection covers whole days: the times are still asked. A
	// timed slot keeps its end date (23:00 to midnight, or over night).
	const timedSlot = slot && !isWholeDays(slot) ? slot : undefined;
	const timed = !!timedSlot;
	const initial = timedSlot
		? dayjs(timedSlot.start)
		: (slot ? dayjs(slot.start) : dayjs(now).add(1, 'day'))
				.hour(10)
				.minute(0);
	const span = timedSlot ? daySpan(timedSlot.start, timedSlot.end) : 0;
	const [day, setDay] = useState<Dayjs | null>(initial);
	const [start, setStart] = useState<Dayjs | null>(initial);
	const [end, setEnd] = useState<Dayjs | null>(
		timedSlot ? dayjs(timedSlot.end) : initial.add(1, 'hour')
	);
	const [kind, setKind] = useState<AppointmentKind>(slot?.kind ?? 'video');
	const [colleagueId, setColleagueId] = useState(fixedColleague?.id ?? '');
	const [showError, setShowError] = useState(false);

	const onsiteOnly =
		colleagues.find((c) => c.id === colleagueId)?.internalChat === false;
	const kinds = onsiteOnly ? ONSITE_ONLY : offeredKinds;
	// A kind that is not offered is never saved: fall back to the first one.
	const chosenKind: AppointmentKind = kinds.includes(kind) ? kind : kinds[0];

	const draft: Partial<AppointmentDraft> = {
		type: 'appointment',
		start: join(day, start)?.toDate(),
		end: join(day ? day.add(span, 'day') : null, end)?.toDate(),
		kind: chosenKind,
		colleagueId: colleagueId || undefined
	};
	const checked = draftError(draft, now);
	const error = checked === 'conversation' ? 'colleague' : checked;
	const conflicts = useMemo(
		() =>
			draft.start && draft.end
				? findConflicts(
						{ start: draft.start, end: draft.end },
						entries,
						ownerId
					)
				: [],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[draft.start?.getTime(), draft.end?.getTime(), entries, ownerId]
	);

	const save = () => {
		if (error) {
			setShowError(true);
			return;
		}
		onSave(draft as AppointmentDraft);
	};

	return {
		testId: 'calendar-colleague-appointment-dialog',
		description: timedSlot
			? format(timedSlot.start, timedSlot.end)
			: t('calendar.dialog.colleagueDescription'),
		icon: slot?.kind ? (
			<FacetIcon facet={slot.kind} />
		) : (
			<EventOutlinedIcon />
		),
		width: slot ? 400 : 680,
		actions: [
			{ label: t('app.cancel'), onClick: onClose },
			{
				label: t(
					conflicts.length
						? 'calendar.dialog.saveAnyway'
						: 'calendar.dialog.save'
				),
				onClick: save,
				primary: true,
				testId: 'calendar-appointment-save'
			}
		],
		content: (
			<div
				className={`calendarDialog${slot ? '' : ' calendarDialog--withMonth'}`}
			>
				{!slot && (
					<div className="calendarDialog__month">
						<OrisoCalendar
							value={day}
							onChange={setDay}
							minDate={dayjs(now).startOf('day')}
							weekStart={1}
							dayLabels={dayLabels}
							disableContainer
						/>
					</div>
				)}
				<div className="calendarDialog__fields">
					{fixedColleague ? (
						<p
							className="calendarDialog__fixedColleague"
							data-cy="calendar-dialog-fixed-colleague"
						>
							<span className="calendarDialog__fixedColleagueLabel">
								{fixedColleagueLabel ??
									t('calendar.dialog.colleague')}
							</span>
							<span className="calendarDialog__fixedColleagueName">
								{fixedColleague.displayName}
							</span>
						</p>
					) : (
						<OrisoSelect
							label={t('calendar.dialog.colleague')}
							value={colleagueId}
							options={colleagues.map((c) => ({
								value: c.id,
								label: c.agencyName
									? `${c.displayName} · ${c.agencyName}`
									: c.displayName
							}))}
							onChange={(event) =>
								setColleagueId(event.target.value)
							}
							error={showError && error === 'colleague'}
							fullWidth
						/>
					)}
					<p className="calendarDialog__note">
						{t(
							onsiteOnly
								? 'calendar.dialog.onsiteOnly'
								: 'calendar.dialog.colleagueHint'
						)}
					</p>
					{!timed && (
						<div className="calendarDialog__times">
							<OrisoTimePicker
								label={t('calendar.dialog.start')}
								ampm={false}
								value={start}
								onChange={setStart}
								cancelLabel={t('app.cancel')}
							/>
							<OrisoTimePicker
								label={t('calendar.dialog.end')}
								ampm={false}
								value={end}
								onChange={setEnd}
								cancelLabel={t('app.cancel')}
							/>
						</div>
					)}
					{(!slot?.kind || onsiteOnly) && (
						<AppointmentKindTiles
							value={chosenKind}
							onChange={setKind}
							kinds={kinds}
						/>
					)}
					{conflicts.length > 0 && (
						<p className="calendarDialog__note" role="status">
							{t('calendar.dialog.conflict', {
								list: conflicts
									.map(
										(c) =>
											`${label(c)} (${format(c.start, c.end)})`
									)
									.join(', ')
							})}
						</p>
					)}
					{showError && error && (
						<p className="calendarDialog__error" role="alert">
							{t(`calendar.dialog.error.${error}`)}
						</p>
					)}
				</div>
			</div>
		)
	};
};
