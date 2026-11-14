/**
 * Create a 1:1 appointment. From a selected slot the time and kind are
 * already chosen, so only the conversation is asked. From the "Termin
 * anlegen" button the dialog shows the month to pick the day (Frank,
 * 2026-11-14: "da müsste dann der Kalender sein").
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoCalendar } from '../form/OrisoCalendar';
import { OrisoTimePicker } from '../form/OrisoTimePicker';
import { OrisoSelect } from '../form/OrisoSelect';
import { ButtonGroup } from '../buttonGroup/ButtonGroup';
import {
	APPOINTMENT_KINDS,
	draftError,
	findConflicts,
	type AppointmentDraft,
	type AppointmentKind,
	type CalendarConversation,
	type CalendarEntry
} from './calendarModel';
import { FacetIcon } from './CalendarEntryGlyph';
import { useEntryLabel, useRangeFormat, useDayLabels } from './useEntryLabel';

const join = (day: Dayjs | null, time: Dayjs | null) =>
	day && time
		? day.hour(time.hour()).minute(time.minute()).second(0).millisecond(0)
		: null;

export interface AppointmentDialogProps {
	open: boolean;
	/** Preset from a selected slot; absent when opened from the button. */
	slot?: { start: Date; end: Date; kind: AppointmentKind };
	/** Preset conversation, e.g. from the quick entry. */
	initialSessionId?: number;
	conversations: CalendarConversation[];
	entries: CalendarEntry[];
	ownerId: string;
	now: Date;
	fullScreen?: boolean;
	onSave: (draft: AppointmentDraft) => void;
	onClose: () => void;
}

export const AppointmentDialog = ({
	open,
	slot,
	initialSessionId,
	conversations,
	entries,
	ownerId,
	now,
	fullScreen,
	onSave,
	onClose
}: AppointmentDialogProps) => {
	const dayLabels = useDayLabels();
	const { t } = useTranslation();
	const format = useRangeFormat();
	const label = useEntryLabel();
	const initial = slot
		? dayjs(slot.start)
		: dayjs(now).add(1, 'day').hour(10).minute(0);
	const [day, setDay] = useState<Dayjs | null>(initial);
	const [start, setStart] = useState<Dayjs | null>(initial);
	const [end, setEnd] = useState<Dayjs | null>(
		slot ? dayjs(slot.end) : initial.add(1, 'hour')
	);
	const [kind, setKind] = useState<AppointmentKind>(slot?.kind ?? 'video');
	const [sessionId, setSessionId] = useState<string>(
		initialSessionId === undefined ? '' : String(initialSessionId)
	);
	const [showError, setShowError] = useState(false);

	const draft: Partial<AppointmentDraft> = {
		type: 'appointment',
		start: join(day, start)?.toDate(),
		end: join(day, end)?.toDate(),
		kind,
		sessionId: sessionId === '' ? undefined : Number(sessionId)
	};
	const error = draftError(draft, now);
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

	return (
		<M3Dialog
			open={open}
			data-testid="calendar-appointment-dialog"
			title={t('calendar.create')}
			description={
				slot
					? format(slot.start, slot.end)
					: t('calendar.dialog.description')
			}
			icon={slot ? <FacetIcon facet={slot.kind} /> : undefined}
			width={slot ? 400 : 680}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			actions={[
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
			]}
		>
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
					<OrisoSelect
						label={t('calendar.dialog.conversation')}
						value={sessionId}
						options={conversations.map((c) => ({
							value: String(c.sessionId),
							label: c.username
						}))}
						onChange={(event) => setSessionId(event.target.value)}
						error={showError && error === 'conversation'}
						fullWidth
					/>
					{!slot && (
						<>
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
							<div
								className="calendarDialog__group"
								role="group"
								aria-label={t('calendar.dialog.kind')}
							>
								<span className="calendarDialog__label">
									{t('calendar.dialog.kind')}
								</span>
								<ButtonGroup
									variant="outline"
									disableAutoStack
									items={APPOINTMENT_KINDS.map((k) => ({
										id: k,
										label: t(`calendar.kinds.${k}`),
										icon: <FacetIcon facet={k} />,
										variant:
											k === kind ? 'tonal' : 'outline',
										ariaLabel: `${t(`calendar.kinds.${k}`)}${k === kind ? ' ✓' : ''}`,
										onClick: () => setKind(k)
									}))}
								/>
							</div>
						</>
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
		</M3Dialog>
	);
};
