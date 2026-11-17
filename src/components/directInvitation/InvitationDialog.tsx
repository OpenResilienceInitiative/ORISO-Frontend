/**
 * The one form for a Direkteinladung, for "Termin anlegen" in a 1:1
 * conversation and for a calendar appointment (#2252, decision 5: one
 * appointment type, one shared dialog). Presentational: it validates and
 * hands the value to `onSubmit`; saving, API errors and notices belong to
 * the caller.
 *
 * Every door shows the same sections in the same order and asks only what
 * it does not know yet:
 *
 *   Beratung (calendar only) → Termin → Art → Weitere Personen per Link
 *   einladen → link settings → conflict note
 *
 * - `variant="invitation"`: date optional. Without one, every person who
 *   opens the link gets their own conversation; with one, they share one
 *   appointment conversation, valid until end + validity.
 * - `variant="appointment"`: date required. `allowGuestInvite` adds the
 *   section "Weitere Personen per Link einladen" (e.g. an interpreter).
 *
 * `useInvitationForm` is the form without its frame, so the calendar's
 * "Neuer Eintrag" can show it as its "Termin" tab; `InvitationDialog` is the
 * frame "Chat erstellen" and the 1:1 use.
 */
import * as React from 'react';
import { useId, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { OrisoCalendar } from '../form/OrisoCalendar';
import { OrisoDatePicker } from '../form/OrisoDatePicker';
import { OrisoSelect } from '../form/OrisoSelect';
import { OrisoTimePicker } from '../form/OrisoTimePicker';
import { M3Dialog, type M3DialogAction } from '../m3Dialog/M3Dialog';
import { Switch } from '../Switch';
import { appointmentSlotError } from '../sessionsList/timeline/conversationAppointments';
import { AppointmentKindTiles } from '../calendar/AppointmentKindTiles';
import {
	DEFAULT_APPOINTMENT_KIND,
	type AppointmentKind
} from '../calendar/calendarModel';
import { useDayLabels } from '../calendar/useEntryLabel';
import {
	DEFAULT_LINK_SETTINGS,
	INVITATION_ACCESS,
	type InvitationAccess,
	type InvitationDialogValue,
	type InvitationPreset,
	type InvitationSlot
} from './invitationModel';
import { ValidityStepper } from './ValidityStepper';
import '../conversationCreate/directLink/directLink.styles.scss';
import './directInvitation.styles.scss';

const SLOT = 'sessionList.timeline.appointment.dialog';
const KEYS = 'directInvitation.dialog';
const DEFAULT_HOUR = 10;
const DEFAULT_MINUTES = 60;
/** The "Beratung" choice that hands over to a Direkteinladung. */
const NEW_PERSON = 'new-person';

const at = (day: Dayjs | null, time: Dayjs | null) =>
	day && time
		? day
				.hour(time.hour())
				.minute(time.minute())
				.second(0)
				.millisecond(0)
				.toDate()
		: null;

/**
 * The fields show one date: an appointment that came in over midnight
 * (23:00 to 00:00, from a calendar slot) keeps its end on the later day
 * while the end time is not after the start. Once it is, the end is on the
 * start day again; a new appointment never wraps.
 */
const overnightEnd = (
	start: Date | null,
	end: Date | null,
	endDays: number
): Date | undefined =>
	start && end && endDays > 0 && end.getTime() <= start.getTime()
		? dayjs(end).add(endDays, 'day').toDate()
		: (end ?? undefined);

export type InvitationDialogVariant = 'invitation' | 'appointment';

export interface InvitationDialogInitial {
	start?: Date;
	end?: Date;
	/** Invitation variant: open with the date section switched on. */
	withAppointment?: boolean;
	/** Appointment variant: open with "invite more people" switched on. */
	inviteOthers?: boolean;
	validityMinutes?: number;
	access?: InvitationAccess;
	knock?: boolean;
	/** With `withKind`: the preselected Art (default video). */
	kind?: AppointmentKind;
}

/** Door C (calendar): the conversation is not known yet. */
export interface InvitationConversationChoice {
	options: { sessionId: number; label: string }[];
	initial?: number;
	/**
	 * Offers "Neue Person per Direkteinladung …": hands the time and Art to
	 * the Direkteinladung of "Chat erstellen" (door A) instead of saving.
	 */
	onInviteNewPerson?: (preset: InvitationPreset) => void;
}

/** What a conflict with other entries means for this slot. */
export interface InvitationConflict {
	/** Already translated, e.g. "Überschneidet sich mit: …". */
	note: string;
	/** The primary action while it conflicts, e.g. "Trotzdem anlegen". */
	actionLabel: string;
}

export interface InvitationFormProps {
	variant: InvitationDialogVariant;
	/** `edit`: change an existing invitation / move an appointment. */
	mode?: 'create' | 'edit';
	initial?: InvitationDialogInitial;
	/** Appointment variant only: offer "Weitere Personen per Link einladen". */
	allowGuestInvite?: boolean;
	/** Called with a validated value. The dialog stays open; the caller closes it. */
	onSubmit: (value: InvitationDialogValue) => void;
	onClose: () => void;
	/** The caller is saving: the primary action waits. */
	saving?: boolean;
	/** Already-translated error from the caller (e.g. the API refused). */
	error?: string;
	/** Appointment variant: ask the Art (Vor Ort, Video, Telefon, Chat). */
	withKind?: boolean;
	/** Ask for the conversation first (the calendar does not know it). */
	conversations?: InvitationConversationChoice;
	/**
	 * What the door already knows and does not ask again: a calendar slot
	 * gives the time (`initial.start`/`end`), a slot with a kind the Art.
	 */
	known?: { slot?: boolean; kind?: boolean };
	/** `month`: the month next to the fields (the calendar's "+"); default a date field. */
	dateLayout?: 'field' | 'month';
	/** Overlaps with the counsellor's other entries for a slot, if any. */
	conflicts?: (slot: InvitationSlot) => InvitationConflict | undefined;
	/** "Now" for the past check; stories and tests pin it. */
	now?: Date;
	/** Replaces the frame's description, e.g. the calendar slot's range. */
	description?: React.ReactNode;
	/** Replaces the icon above the title, e.g. the slot's kind. */
	icon?: React.ReactNode;
	/** Test ids the door's own tests rely on. */
	testIds?: { root?: string; submit?: string };
}

export interface InvitationDialogProps extends InvitationFormProps {
	/** M3 full-screen presentation on phones; the caller picks the breakpoint. */
	fullScreen?: boolean;
}

/** The form without its frame: what the frame shows around it and the content. */
export interface InvitationForm {
	title: string;
	description: React.ReactNode;
	icon: React.ReactNode;
	width: number;
	actions: M3DialogAction[];
	content: React.ReactNode;
	testId: string;
}

/** The calendar's "+": the month to pick the day ("da müsste dann der Kalender sein"). */
const InvitationMonth = ({
	value,
	onChange,
	now
}: {
	value: Dayjs | null;
	onChange: (day: Dayjs | null) => void;
	now?: Date;
}) => {
	const dayLabels = useDayLabels();
	return (
		<div className="invitationDialog__month">
			<OrisoCalendar
				value={value}
				onChange={onChange}
				minDate={dayjs(now).startOf('day')}
				weekStart={1}
				dayLabels={dayLabels}
				disableContainer
			/>
		</div>
	);
};

export const useInvitationForm = ({
	variant,
	mode = 'create',
	initial = {},
	allowGuestInvite = false,
	onSubmit,
	onClose,
	saving = false,
	error,
	withKind = false,
	conversations,
	known = {},
	dateLayout = 'field',
	conflicts,
	now,
	description,
	icon,
	testIds = {}
}: InvitationFormProps): InvitationForm => {
	const { t } = useTranslation();
	const id = useId();
	const isInvitation = variant === 'invitation';
	const slotKnown = Boolean(known.slot && initial.start && initial.end);
	const initialStart = initial.start
		? dayjs(initial.start)
		: dayjs(now).add(1, 'day').hour(DEFAULT_HOUR).minute(0);
	const [withAppointment, setWithAppointment] = useState(
		isInvitation ? Boolean(initial.withAppointment ?? initial.start) : true
	);
	const [inviteOthers, setInviteOthers] = useState(
		Boolean(initial.inviteOthers)
	);
	/* Days from the given start to the given end: 1 for 23:00 to 00:00. */
	const initialEndDays =
		initial.start && initial.end
			? dayjs(initial.end)
					.startOf('day')
					.diff(dayjs(initial.start).startOf('day'), 'day')
			: 0;
	const [day, setDay] = useState<Dayjs | null>(initialStart);
	const [startTime, setStartTime] = useState<Dayjs | null>(initialStart);
	const [endTime, setEndTime] = useState<Dayjs | null>(
		initial.end
			? dayjs(initial.end)
			: initialStart.add(DEFAULT_MINUTES, 'minute')
	);
	const [kind, setKind] = useState<AppointmentKind>(
		initial.kind ?? DEFAULT_APPOINTMENT_KIND
	);
	const [conversation, setConversation] = useState<string>(
		conversations?.initial === undefined
			? ''
			: String(conversations.initial)
	);
	const [validity, setValidity] = useState(
		initial.validityMinutes ?? DEFAULT_LINK_SETTINGS.validityMinutes
	);
	const [access, setAccess] = useState<InvitationAccess>(
		initial.access ?? DEFAULT_LINK_SETTINGS.access
	);
	const [knock, setKnock] = useState(
		initial.knock ?? DEFAULT_LINK_SETTINGS.knock
	);
	const [changedLink, setChangedLink] = useState({
		validityMinutes: false,
		access: false,
		knock: false
	});
	const [formError, setFormError] = useState<{
		text: string;
		field?: 'conversation';
	}>();

	const newPerson = conversation === NEW_PERSON;
	const showLinkSettings =
		isInvitation || (allowGuestInvite && inviteOthers && !newPerson);
	/* A known slot keeps its own end date (23:00 to midnight, over night). */
	const slot: Partial<InvitationSlot> = slotKnown
		? { start: initial.start, end: initial.end }
		: {
				start: at(day, startTime) ?? undefined,
				end: overnightEnd(
					at(day, startTime),
					at(day, endTime),
					initialEndDays
				)
			};
	const conflict =
		withAppointment && conflicts && slot.start && slot.end
			? conflicts({ start: slot.start, end: slot.end })
			: undefined;

	const submit = () => {
		let appointment: InvitationDialogValue['appointment'] = null;
		if (withAppointment) {
			const { start, end } = slot;
			/* An appointment which has already started may still be edited (for
			   example to extend its validity). Keep accepting its original start,
			   while a newly selected start must still be in the future. */
			const unchangedStart =
				mode === 'edit' &&
				Boolean(
					initial.start &&
						start?.getTime() === initial.start.getTime()
				);
			const problem = appointmentSlotError(
				{ start, end },
				unchangedStart && start
					? new Date(start.getTime() - 1)
					: (now ?? new Date())
			);
			if (problem || !start || !end) {
				setFormError({ text: t(`${SLOT}.error.${problem}`) });
				return;
			}
			appointment = { start, end };
		}
		if (conversations && conversation === '') {
			setFormError({
				text: t('calendar.dialog.error.conversation'),
				field: 'conversation'
			});
			return;
		}
		setFormError(undefined);
		if (newPerson && appointment) {
			conversations?.onInviteNewPerson?.({
				...appointment,
				...(withKind ? { kind } : {})
			});
			return;
		}
		const initialAppointment = initial.start && initial.end;
		onSubmit({
			appointment,
			link: showLinkSettings
				? {
						validityMinutes: appointment ? validity : null,
						access,
						knock
					}
				: null,
			...(withKind ? { kind } : {}),
			...(conversations ? { sessionId: Number(conversation) } : {}),
			...(mode === 'edit'
				? {
						changed: {
							appointment: Boolean(
								appointment &&
									(!initialAppointment ||
										appointment.start.getTime() !==
											initial.start!.getTime() ||
										appointment.end.getTime() !==
											initial.end!.getTime())
							),
							validityMinutes:
								appointment !== null &&
								changedLink.validityMinutes,
							access: changedLink.access,
							knock: changedLink.knock
						}
					}
				: {})
		});
	};

	const title = isInvitation
		? t(`${KEYS}.${mode === 'edit' ? 'editTitle' : 'createTitle'}`)
		: t(`${SLOT}.${mode === 'edit' ? 'moveTitle' : 'createTitle'}`);
	const action = newPerson
		? t(`${KEYS}.newPerson.action`)
		: (conflict?.actionLabel ??
			(isInvitation
				? t(
						`${KEYS}.${mode === 'edit' ? 'saveAction' : 'createAction'}`
					)
				: t(
						`${SLOT}.${mode === 'edit' ? 'moveAction' : 'createAction'}`
					)));
	const shownError = formError?.text ?? error;
	const month = dateLayout === 'month' && withAppointment && !slotKnown;

	const switchRow = (
		key: string,
		checked: boolean,
		onChange: (next: boolean) => void,
		hint?: string
	) => (
		<div className="invitationDialog__switchRow">
			<span className="invitationDialog__switchText">
				<span id={`${id}-${key}`}>{t(`${KEYS}.${key}`)}</span>
				{hint && (
					<span
						id={`${id}-${key}-hint`}
						className="invitationDialog__hint"
					>
						{hint}
					</span>
				)}
			</span>
			<Switch
				checked={checked}
				onChange={onChange}
				aria-labelledby={`${id}-${key}`}
				aria-describedby={hint ? `${id}-${key}-hint` : undefined}
			/>
		</div>
	);

	const fields = (
		<div className="invitationDialog__fields">
			{conversations && (
				<section data-section="conversation">
					<OrisoSelect
						label={t('calendar.dialog.conversation')}
						value={conversation}
						options={[
							...conversations.options.map((option) => ({
								value: String(option.sessionId),
								label: option.label
							})),
							...(conversations.onInviteNewPerson
								? [
										{
											value: NEW_PERSON,
											label: t(`${KEYS}.newPerson.option`)
										}
									]
								: [])
						]}
						onChange={(event) =>
							setConversation(String(event.target.value))
						}
						error={formError?.field === 'conversation'}
						fullWidth
					/>
					{newPerson && (
						<p className="invitationDialog__hint" role="status">
							{t(`${KEYS}.newPerson.hint`)}
						</p>
					)}
				</section>
			)}
			{/* Editing keeps the appointment: the backend cannot drop
			    one from an invitation, only move it. */}
			{isInvitation &&
				mode !== 'edit' &&
				switchRow(
					'withAppointment',
					withAppointment,
					setWithAppointment,
					t(
						`${KEYS}.${withAppointment ? 'withAppointmentHint' : 'withoutAppointmentHint'}`
					)
				)}
			{withAppointment && !slotKnown && (
				<section className="invitationDialog__slot" data-section="slot">
					{!month && (
						<OrisoDatePicker
							label={t(`${SLOT}.date`)}
							value={day}
							onChange={setDay}
							minDate={dayjs(now).startOf('day')}
							weekStart={1}
						/>
					)}
					<div className="invitationDialog__times">
						<OrisoTimePicker
							label={t(`${SLOT}.start`)}
							ampm={false}
							value={startTime}
							onChange={setStartTime}
							cancelLabel={t('app.cancel')}
						/>
						<OrisoTimePicker
							label={t(`${SLOT}.end`)}
							ampm={false}
							value={endTime}
							onChange={setEndTime}
							cancelLabel={t('app.cancel')}
						/>
					</div>
				</section>
			)}
			{withKind && !known.kind && (
				<AppointmentKindTiles value={kind} onChange={setKind} />
			)}
			{!isInvitation && allowGuestInvite && !newPerson && (
				<section
					className="invitationDialog__invite"
					aria-labelledby={`${id}-inviteOthers`}
					data-section="invite"
				>
					{switchRow(
						'inviteOthers',
						inviteOthers,
						setInviteOthers,
						t(`${KEYS}.inviteOthersHint`)
					)}
				</section>
			)}
			{showLinkSettings && (
				<div className="invitationDialog__link" data-section="link">
					{withAppointment && (
						<ValidityStepper
							value={validity}
							onChange={(value) => {
								setValidity(value);
								setChangedLink((before) => ({
									...before,
									validityMinutes: true
								}));
							}}
						/>
					)}
					<div className="invitationDialog__access">
						<span
							id={`${id}-access`}
							className="invitationDialog__label"
						>
							{t(`${KEYS}.access.label`)}
						</span>
						<ToggleButtonGroup
							exclusive
							fullWidth
							size="small"
							color="primary"
							aria-labelledby={`${id}-access`}
							value={access}
							onChange={(
								_event,
								value: InvitationAccess | null
							) => {
								/* Exclusive and required: a second click keeps it. */
								if (value) {
									setAccess(value);
									setChangedLink((before) => ({
										...before,
										access: true
									}));
								}
							}}
						>
							{INVITATION_ACCESS.map((value) => (
								<ToggleButton
									key={value}
									value={value}
									sx={{ textTransform: 'none' }}
								>
									{t(`${KEYS}.access.${value}`)}
								</ToggleButton>
							))}
						</ToggleButtonGroup>
					</div>
					{switchRow(
						'knock',
						knock,
						(value) => {
							setKnock(value);
							setChangedLink((before) => ({
								...before,
								knock: true
							}));
						},
						t(`${KEYS}.knockHint`)
					)}
				</div>
			)}
			{conflict && (
				<p
					className="invitationDialog__hint"
					role="status"
					data-section="conflict"
				>
					{conflict.note}
				</p>
			)}
			{shownError && (
				<p className="invitationDialog__error" role="alert">
					{shownError}
				</p>
			)}
		</div>
	);

	return {
		title,
		description:
			description ??
			(isInvitation
				? t(`${KEYS}.description`)
				: t(`${SLOT}.description`)),
		/* Every creation dialog has an icon above its title (Frank *1). */
		icon:
			icon ??
			(isInvitation ? <LinkOutlinedIcon /> : <EventOutlinedIcon />),
		width: month ? 680 : 480,
		testId: testIds.root ?? 'invitation-dialog',
		actions: [
			{ label: t('app.cancel'), onClick: onClose },
			{
				label: action,
				onClick: submit,
				primary: true,
				disabled: saving,
				busy: saving,
				...(testIds.submit ? { testId: testIds.submit } : {})
			}
		],
		content: (
			<div
				className={`invitationDialog${month ? ' invitationDialog--withMonth' : ''}`}
			>
				{month && (
					<InvitationMonth value={day} onChange={setDay} now={now} />
				)}
				{fields}
			</div>
		)
	};
};

export const InvitationDialog = ({
	fullScreen = false,
	...props
}: InvitationDialogProps) => {
	const { t } = useTranslation();
	const form = useInvitationForm(props);
	return (
		<M3Dialog
			open
			data-testid={form.testId}
			title={form.title}
			description={form.description}
			icon={form.icon}
			width={form.width}
			fullScreen={fullScreen}
			onClose={props.onClose}
			closeLabel={t('app.close')}
			actions={form.actions}
		>
			{form.content}
		</M3Dialog>
	);
};
