/**
 * The one dialog for a Direkteinladung and for "Termin anlegen" in a 1:1
 * conversation (#2252, decision 5). Presentational: it validates the slot
 * and hands the value to `onSubmit`; saving, API errors and notices belong
 * to the caller.
 *
 * - `variant="invitation"`: date optional. Without one, every person who
 *   opens the link gets their own conversation; with one, they share one
 *   appointment conversation, valid until end + validity.
 * - `variant="appointment"`: date required. `allowGuestInvite` adds the
 *   section "Weitere Personen per Link einladen" (e.g. an interpreter).
 */
import * as React from 'react';
import { useId, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { OrisoDatePicker } from '../form/OrisoDatePicker';
import { OrisoTimePicker } from '../form/OrisoTimePicker';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { Switch } from '../Switch';
import { appointmentSlotError } from '../sessionsList/timeline/conversationAppointments';
import {
	DEFAULT_LINK_SETTINGS,
	INVITATION_ACCESS,
	type InvitationAccess,
	type InvitationDialogValue
} from './invitationModel';
import { ValidityStepper } from './ValidityStepper';
import '../conversationCreate/directLink/directLink.styles.scss';
import './directInvitation.styles.scss';

const SLOT = 'sessionList.timeline.appointment.dialog';
const KEYS = 'directInvitation.dialog';
const DEFAULT_HOUR = 10;
const DEFAULT_MINUTES = 60;

const at = (day: Dayjs | null, time: Dayjs | null) =>
	day && time
		? day
				.hour(time.hour())
				.minute(time.minute())
				.second(0)
				.millisecond(0)
				.toDate()
		: null;

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
}

export interface InvitationDialogProps {
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
	/** M3 full-screen presentation on phones; the caller picks the breakpoint. */
	fullScreen?: boolean;
}

export const InvitationDialog = ({
	variant,
	mode = 'create',
	initial = {},
	allowGuestInvite = false,
	onSubmit,
	onClose,
	saving = false,
	error,
	fullScreen = false
}: InvitationDialogProps) => {
	const { t } = useTranslation();
	const id = useId();
	const isInvitation = variant === 'invitation';
	const initialStart = initial.start
		? dayjs(initial.start)
		: dayjs().add(1, 'day').hour(DEFAULT_HOUR).minute(0);
	const [withAppointment, setWithAppointment] = useState(
		isInvitation ? Boolean(initial.withAppointment ?? initial.start) : true
	);
	const [inviteOthers, setInviteOthers] = useState(
		Boolean(initial.inviteOthers)
	);
	const [day, setDay] = useState<Dayjs | null>(initialStart);
	const [startTime, setStartTime] = useState<Dayjs | null>(initialStart);
	const [endTime, setEndTime] = useState<Dayjs | null>(
		initial.end
			? dayjs(initial.end)
			: initialStart.add(DEFAULT_MINUTES, 'minute')
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
	const [slotError, setSlotError] = useState<string>();

	const showLinkSettings = isInvitation || (allowGuestInvite && inviteOthers);

	const submit = () => {
		let appointment: InvitationDialogValue['appointment'] = null;
		if (withAppointment) {
			const start = at(day, startTime);
			const end = at(day, endTime);
			const problem = appointmentSlotError({ start, end }, new Date());
			if (problem || !start || !end) {
				setSlotError(t(`${SLOT}.error.${problem}`));
				return;
			}
			appointment = { start, end };
		}
		setSlotError(undefined);
		onSubmit({
			appointment,
			link: showLinkSettings
				? {
						validityMinutes: appointment ? validity : null,
						access,
						knock
					}
				: null
		});
	};

	const title = isInvitation
		? t(`${KEYS}.${mode === 'edit' ? 'editTitle' : 'createTitle'}`)
		: t(`${SLOT}.${mode === 'edit' ? 'moveTitle' : 'createTitle'}`);
	const action = isInvitation
		? t(`${KEYS}.${mode === 'edit' ? 'saveAction' : 'createAction'}`)
		: t(`${SLOT}.${mode === 'edit' ? 'moveAction' : 'createAction'}`);
	const shownError = slotError ?? error;

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

	return (
		<M3Dialog
			open
			data-testid="invitation-dialog"
			title={title}
			description={
				isInvitation
					? t(`${KEYS}.description`)
					: t(`${SLOT}.description`)
			}
			width={480}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			actions={[
				{ label: t('app.cancel'), onClick: onClose },
				{
					label: action,
					onClick: submit,
					primary: true,
					disabled: saving,
					busy: saving
				}
			]}
		>
			<div className="invitationDialog">
				{isInvitation &&
					switchRow(
						'withAppointment',
						withAppointment,
						setWithAppointment,
						t(
							`${KEYS}.${withAppointment ? 'withAppointmentHint' : 'withoutAppointmentHint'}`
						)
					)}
				{withAppointment && (
					<section className="invitationDialog__slot">
						<OrisoDatePicker
							label={t(`${SLOT}.date`)}
							value={day}
							onChange={setDay}
							minDate={dayjs().startOf('day')}
							weekStart={1}
						/>
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
				{!isInvitation && allowGuestInvite && (
					<section
						className="invitationDialog__invite"
						aria-labelledby={`${id}-inviteOthers`}
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
					<>
						{withAppointment && (
							<ValidityStepper
								value={validity}
								onChange={setValidity}
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
									if (value) setAccess(value);
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
							setKnock,
							t(`${KEYS}.knockHint`)
						)}
					</>
				)}
				{shownError && (
					<p className="invitationDialog__error" role="alert">
						{shownError}
					</p>
				)}
			</div>
		</M3Dialog>
	);
};
