import { useEffect, useState } from 'react';
import { apiGetConsultantSessionList } from '../../../api';
import { SESSION_LIST_TYPES } from '../../../components/session/sessionHelpers';
import { ListItemsResponseInterface } from '../../../globalState/interfaces/SessionsDataInterface';
import { isChatItemUnread } from '../../../utils/sessionUnread';

interface ConsultantDataProps {
	type: SESSION_LIST_TYPES;
	unReadOnly?: boolean;
}
export const useConsultantData = ({
	type,
	unReadOnly
}: ConsultantDataProps) => {
	const [isLoading, setIsLoading] = useState(false);
	const [data, setData] = useState<ListItemsResponseInterface>({
		count: 0,
		offset: 0,
		sessions: [],
		total: 0
	});

	useEffect(() => {
		const abortController = new AbortController();
		setIsLoading(true);

		apiGetConsultantSessionList({
			type,
			count: 50,
			signal: abortController.signal
		})
			.then((data) => {
				if (unReadOnly) {
					// The backend doesn't support this filter (its
					// messagesRead is a hard-coded constant), so grab a
					// bigger page and derive unread from the Matrix
					// client (#1147).
					const sessions = data.sessions.filter(
						(session) =>
							session.session && isChatItemUnread(session.session)
					);
					setData({
						...data,
						total: sessions.length,
						sessions
					});
				} else {
					setData(data);
				}
			})
			.finally(() => setIsLoading(false));

		return () => abortController.abort();
	}, [type, unReadOnly]);

	return { ...data, isLoading };
};
