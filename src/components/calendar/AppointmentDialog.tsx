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
import { M3Dialog, type M3DialogAction } from '../m3Dialog/M3Dialog';
import { OrisoCalendar } from '../form/OrisoCalendar';
import { OrisoTimePicker } from '../form/OrisoTimePicker';
import { OrisoSelect } from '../form/OrisoSelect';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import {
	APPOINTMENT_KINDS,
	daySpan,
	draftError,
	findConflicts,
	isWholeDays,
	type AppointmentDraft,
	type AppointmentKind,
	type CalendarConversation,
	type CalendarEntry,
	type Colleague
} from './calendarModel';
import { FacetIcon } from './CalendarEntryGlyph';
import { useEntryLabel, useRangeFormat, useDayLabels } from './useEntryLabel';

const join = (day: Dayjs | null, time: Dayjs | null) =>
	day && time
		? day.hour(time.hour()).minute(time.minute()).second(0).millisecond(0)
		: null;

type WithWhom = 'conversation' | 'colleague';
const WITH_WHOM: WithWhom[] = ['conversation', 'colleague'];

export interface AppointmentDialogProps {
	open: boolean;
	/**
	 * Preset from a selected slot; absent when opened from the button. A
	 * slot without a kind ("Neuer Eintrag" from a drag) still offers the
	 * kind tiles.
	 */
	slot?: { start: Date; end: Date; kind?: AppointmentKind };
	/** Preset conversation, e.g. from the quick entry. */
	initialSessionId?: number;
	conversations: CalendarConversation[];
	/**
	 * Colleagues one may meet instead of an advice seeker (FE#2305): the
	 * calendar's colleague list. Without any, only conversations are offered.
	 */
	colleagues?: Colleague[];
	entries: CalendarEntry[];
	ownerId: string;
	now: Date;
	fullScreen?: boolean;
	onSave: (draft: AppointmentDraft) => void;
	onClose: () => void;
}

/**
 * A creation form without its dialog frame: what the frame shows around it
 * and the content. "Neuer Eintrag" puts the appointment and the blocker
 * form under one title with tabs (prototype v17); each keeps its state.
 */
export interface DialogForm {
	description?: React.ReactNode;
	icon?: React.ReactNode;
	width: number;
	actions: M3DialogAction[];
	content: React.ReactNode;
	/** The dialog's `data-testid` while this form shows. */
	testId: string;
	/** A switch shown in the dialog's top row, next to the tabs. */
	toolbar?: React.ReactNode;
}

export type AppointmentFormProps = Omit<
	AppointmentDialogProps,
	'open' | 'fullScreen'
>;

export const useAppointmentForm = ({
	slot,
	initialSessionId,
	conversations,
	colleagues = [],
	entries,
	ownerId,
	now,
	onSave,
	onClose
}: AppointmentFormProps): DialogForm => {
	const dayLabels = useDayLabels();
	const { t } = useTranslation();
	const format = useRangeFormat();
	const label = useEntryLabel();
	// A month selection covers whole days: an appointment still needs its
	// times, so the dialog asks for them. A timed slot keeps its end date
	// (23:00 to midnight, or over night).
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
	const [sessionId, setSessionId] = useState<string>(
		initialSessionId === undefined ? '' : String(initialSessionId)
	);
	// "Mit Beratung" or "Mit Kollegin/Kollege" (FE#2305, Frank: "Was ist,
	// wenn ich einfach mit einem Kollegen sprechen will?").
	const [withWhom, setWithWhom] = useState<WithWhom>('conversation');
	const [colleagueId, setColleagueId] = useState('');
	const [showError, setShowError] = useState(false);
	const withColleague = withWhom === 'colleague';
	// Where no internal chat is allowed, only "Vor Ort" is possible (Frank,
	// 2026-11-17: "dann zeigst du halt einfach nur einen Vor-Ort-Termin an").
	const onsiteOnly =
		withColleague &&
		colleagues.find((c) => c.id === colleagueId)?.internalChat === false;
	const kinds: AppointmentKind[] = onsiteOnly
		? ['onsite']
		: APPOINTMENT_KINDS;
	const chosenKind: AppointmentKind = onsiteOnly ? 'onsite' : kind;

	const draft: Partial<AppointmentDraft> = {
		type: 'appointment',
		start: join(day, start)?.toDate(),
		end: join(day ? day.add(span, 'day') : null, end)?.toDate(),
		kind: chosenKind,
		...(withColleague
			? { colleagueId: colleagueId || undefined }
			: { sessionId: sessionId === '' ? undefined : Number(sessionId) })
	};
	const checked = draftError(draft, now);
	const error =
		checked === 'conversation' && withColleague ? 'colleague' : checked;
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

	// On the same line as "Termin | Sperrzeit" (Frank, 2026-11-17: "alles
	// in eine Linie"), so both columns below start at the same height.
	const toolbar =
		colleagues.length > 0 ? (
			<div
				className="calendarNewEntry__tabs calendarDialog__with"
				role="radiogroup"
				aria-label={t('calendar.dialog.withWhom')}
			>
				{WITH_WHOM.map((value) => (
					<button
						key={value}
						type="button"
						role="radio"
						className="calendarNewEntry__tab"
						aria-checked={withWhom === value}
						onClick={() => setWithWhom(value)}
						data-cy={`calendar-dialog-with-${value}`}
					>
						{t(
							value === 'colleague'
								? 'calendar.dialog.withColleague'
								: 'calendar.dialog.withConversation'
						)}
					</button>
				))}
			</div>
		) : undefined;

	return {
		testId: 'calendar-appointment-dialog',
		toolbar,
		description: timedSlot
			? format(timedSlot.start, timedSlot.end)
			: t('calendar.dialog.description'),
		// Every creation dialog has an icon above its title (Frank, *1).
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
					{withColleague ? (
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
					) : (
						<OrisoSelect
							label={t('calendar.dialog.conversation')}
							value={sessionId}
							options={conversations.map((c) => ({
								value: String(c.sessionId),
								label: c.username
							}))}
							onChange={(event) =>
								setSessionId(event.target.value)
							}
							error={showError && error === 'conversation'}
							fullWidth
						/>
					)}
					{withColleague && (
						<p className="calendarDialog__note">
							{t(
								onsiteOnly
									? 'calendar.dialog.onsiteOnly'
									: 'calendar.dialog.colleagueHint'
							)}
						</p>
					)}
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
					{!slot?.kind && (
						// "Art" as button tiles in a grid that wraps, never a
						// row that runs out of the dialog (Frank *1; test C7).
						<div
							className="calendarDialog__group"
							role="group"
							aria-label={t('calendar.dialog.kind')}
						>
							<span className="calendarDialog__label">
								{t('calendar.dialog.kind')}
							</span>
							<div className="calendarDialog__kinds">
								{kinds.map((k) => (
									<button
										key={k}
										type="button"
										className="calendarDialog__kindTile"
										aria-pressed={k === chosenKind}
										onClick={() => setKind(k)}
										data-cy={`calendar-dialog-kind-${k}`}
									>
										<FacetIcon facet={k} />
										<span>{t(`calendar.kinds.${k}`)}</span>
									</button>
								))}
							</div>
						</div>
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

export const AppointmentDialog = ({
	open,
	fullScreen,
	...props
}: AppointmentDialogProps) => {
	const { t } = useTranslation();
	const form = useAppointmentForm(props);
	return (
		<M3Dialog
			open={open}
			data-testid={form.testId}
			title={t('calendar.create')}
			description={form.description}
			icon={form.icon}
			width={form.width}
			fullScreen={fullScreen}
			onClose={props.onClose}
			closeLabel={t('app.close')}
			actions={form.actions}
		>
			{form.toolbar && (
				<div className="calendarNewEntry__head">{form.toolbar}</div>
			)}
			{form.content}
		</M3Dialog>
	);
};
