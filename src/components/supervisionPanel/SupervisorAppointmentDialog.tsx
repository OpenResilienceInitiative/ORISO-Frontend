/**
 * "Termin mit Supervisor:in vereinbaren" (FE#2494): the calendar's
 * appointment with a colleague (FE#2305), opened from the ⋮ menu of a
 * Supervision room with the supervisor already chosen. One appointment
 * module: the same form, rules and save path as "Neuer Eintrag → Kolleg:in"
 * in the calendar; this file only frames it and loads what it needs.
 *
 * UserService books it into both calendars and opens (or reuses) the
 * private internal chat of the two, where the notice goes. A supervisor
 * outside the own calendar reach cannot be booked (UserService answers 404):
 * the dialog says so instead of offering a save that must fail.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiCreateColleagueAppointment,
	apiGetCalendarColleagues,
	apiGetCalendarEntries
} from '../../api/apiCalendar';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { useColleagueAppointmentForm } from '../calendar/ColleagueAppointmentForm';
import {
	colleagueFromApi,
	entryFromApi,
	kindToApi
} from '../calendar/calendarApiMapping';
import type {
	AppointmentDraft,
	CalendarEntry,
	Colleague
} from '../calendar/calendarModel';
import { notifyAppointmentsChanged } from '../sessionsList/timeline/conversationAppointments';
import { useAppointmentNotice } from '../sessionsList/timeline/useAppointmentNotice';

export interface SupervisorAppointmentDialogProps {
	/** The supervisor of the room (`supervisorConsultantId`). */
	supervisor: { id: string; displayName: string };
	/** The own consultant id, for the conflict check. */
	ownerId: string;
	/**
	 * The own calendar reach. `undefined` while it loads; a supervisor not
	 * in it cannot be booked.
	 */
	colleagues?: Colleague[];
	/** Own entries around now, for the conflict note. */
	entries: CalendarEntry[];
	now?: Date;
	saving?: boolean;
	/** Already translated. */
	error?: string;
	fullScreen?: boolean;
	onSave: (draft: AppointmentDraft) => void;
	onClose: () => void;
}

/** The dialog without data access (Storybook, tests). */
export const SupervisorAppointmentDialog = ({
	supervisor,
	ownerId,
	colleagues,
	entries,
	now = new Date(),
	saving = false,
	error,
	fullScreen = false,
	onSave,
	onClose
}: SupervisorAppointmentDialogProps) => {
	const { t } = useTranslation();
	const known = colleagues?.find((c) => c.id === supervisor.id);
	const unreachable = colleagues !== undefined && !known;
	const form = useColleagueAppointmentForm({
		colleagues: known ? [known] : [],
		fixedColleague: supervisor,
		fixedColleagueLabel: t('supervision.appointment.with'),
		entries,
		ownerId,
		now,
		onSave,
		onClose
	});
	const actions = unreachable
		? [{ label: t('app.close'), onClick: onClose, primary: true }]
		: form.actions.map((action) =>
				action.primary
					? {
							...action,
							busy: saving,
							disabled: saving || colleagues === undefined
						}
					: action
			);

	return (
		<M3Dialog
			open
			data-testid="supervision-appointment-dialog"
			title={t('supervision.appointment.title')}
			description={t('supervision.appointment.description')}
			icon={form.icon}
			width={680}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			actions={actions}
		>
			{unreachable ? (
				<p
					className="calendarDialog__note"
					role="status"
					data-testid="supervision-appointment-unreachable"
				>
					{t('supervision.appointment.unreachable', {
						name: supervisor.displayName
					})}
				</p>
			) : (
				form.content
			)}
			{error && (
				<p className="calendarDialog__error" role="alert">
					{error}
				</p>
			)}
		</M3Dialog>
	);
};

const DAY = 24 * 60 * 60 * 1000;

export type SupervisorAppointmentDialogWiredProps = Omit<
	SupervisorAppointmentDialogProps,
	'colleagues' | 'entries' | 'saving' | 'error' | 'onSave'
>;

/** Loads the calendar reach and the own entries, saves through UserService. */
export const SupervisorAppointmentDialogWired = (
	props: SupervisorAppointmentDialogWiredProps
) => {
	const { t } = useTranslation();
	const sendNotice = useAppointmentNotice();
	const [colleagues, setColleagues] = useState<Colleague[]>();
	const [entries, setEntries] = useState<CalendarEntry[]>([]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();

	useEffect(() => {
		let cancelled = false;
		apiGetCalendarColleagues().then(
			(dto) =>
				!cancelled &&
				setColleagues(dto.colleagues.map(colleagueFromApi)),
			// Without the list the save still tries; UserService decides.
			() =>
				!cancelled &&
				setColleagues([
					{
						...props.supervisor,
						agencyName: '',
						relation: 'sameTenant'
					}
				])
		);
		const from = new Date();
		apiGetCalendarEntries(from, new Date(from.getTime() + 60 * DAY)).then(
			(dto) => !cancelled && setEntries((dto ?? []).map(entryFromApi)),
			() => undefined
		);
		return () => {
			cancelled = true;
		};
	}, [props.supervisor]);

	const save = async (draft: AppointmentDraft) => {
		setSaving(true);
		setError(undefined);
		try {
			const created = await apiCreateColleagueAppointment({
				colleagueId: props.supervisor.id,
				start: draft.start.toISOString(),
				end: draft.end.toISOString(),
				kind: kindToApi(draft.kind ?? 'video')
			});
			notifyAppointmentsChanged();
			if (created?.matrixRoomId && typeof created.chatId === 'number')
				await sendNotice({
					kind: 'created',
					start: draft.start,
					end: draft.end,
					sessionId: created.chatId,
					matrixRoomId: created.matrixRoomId
				});
			props.onClose();
		} catch {
			setError(t('supervision.appointment.failed'));
		} finally {
			setSaving(false);
		}
	};

	return (
		<SupervisorAppointmentDialog
			{...props}
			colleagues={colleagues}
			entries={entries}
			saving={saving}
			error={error}
			onSave={save}
		/>
	);
};
