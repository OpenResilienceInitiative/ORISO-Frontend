/**
 * What the appointment menu does (ADR-021 table). Group dates: cancel via
 * the series API, duplicate into the create-group form (kept from the old
 * future strip), configure the group. 1:1 bookings: cal.com's reschedule
 * and cancel pages. Entries marked "kommt bald" never reach this.
 */
import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionTypeContext } from '../../../globalState';
import { apiSkipChatOccurrence } from '../../../api/apiGetChatOccurrences';
import { useSearchParam } from '../../../hooks/useSearchParams';
import { buildCreateGroupChatPath } from '../SessionsListToolbar';
import type { FutureEntry } from './timelineModel';

export interface AppointmentActionsOptions {
	/** A date was cancelled: drop it from what is shown. */
	onCancelled?: (entry: FutureEntry) => void;
	onError?: () => void;
}

export const useAppointmentActions = ({
	onCancelled,
	onError
}: AppointmentActionsOptions = {}) => {
	const navigate = useNavigate();
	const { path: listPath } = useContext(SessionTypeContext);
	const sessionListTab = useSearchParam<string>('sessionListTab');
	const tabQuery = sessionListTab ? `?sessionListTab=${sessionListTab}` : '';

	return useCallback(
		(key: string, entry: FutureEntry) => {
			const { occurrence, booking } = entry;
			switch (key) {
				case 'cancel':
					if (occurrence) {
						apiSkipChatOccurrence(
							occurrence.seriesId,
							occurrence.originalStart
						).then(
							() => onCancelled?.(entry),
							() => onError?.()
						);
					} else if (booking?.uid) {
						navigate('/booking/cancellation', {
							state: { uid: booking.uid }
						});
					}
					return;
				case 'reschedule':
					if (booking?.rescheduleLink) {
						navigate('/booking/reschedule', {
							state: {
								rescheduleLink: booking.rescheduleLink,
								bookingId: booking.id,
								askerId: booking.askerId
							}
						});
					}
					return;
				case 'duplicate':
					if (occurrence) {
						navigate(
							buildCreateGroupChatPath(
								sessionListTab || undefined
							),
							{
								state: {
									duplicateOccurrence: {
										topic: entry.topic ?? entry.title,
										start: entry.start.toISOString(),
										duration: occurrence.duration,
										modality: occurrence.modality
									}
								}
							}
						);
					}
					return;
				case 'configure':
					if (entry.matrixRoomId && entry.sessionId !== undefined) {
						navigate(
							`${listPath}/${entry.matrixRoomId}/${entry.sessionId}/editGroupChat${tabQuery}`,
							{
								state: {
									isEditMode: true,
									prevIsInfoPage: false
								}
							}
						);
					}
					return;
				default:
			}
		},
		[navigate, listPath, sessionListTab, tabQuery, onCancelled, onError]
	);
};
