type EnquiryListPage<T> = {
	sessions: T[];
	total: number;
};

type RefetchEnquiryListStateOptions<T> = {
	fetchPage: () => Promise<EnquiryListPage<T>>;
	replaceSessions: (sessions: T[]) => void;
	setTotalItems: (total: number) => void;
	setCurrentOffset: (offset: number) => void;
};

/**
 * Replaces the visible enquiry queue with the latest backend state.
 * A 204 response is surfaced by the API layer as `Error('EMPTY')`; that is a
 * successful empty snapshot and must clear stale sessions from the UI.
 */
export const refetchEnquiryListState = async <T>({
	fetchPage,
	replaceSessions,
	setTotalItems,
	setCurrentOffset
}: RefetchEnquiryListStateOptions<T>): Promise<void> => {
	try {
		const { sessions, total } = await fetchPage();
		replaceSessions(sessions);
		setTotalItems(total);
		setCurrentOffset(0);
	} catch (error) {
		if (!(error instanceof Error) || error.message !== 'EMPTY') {
			return;
		}

		replaceSessions([]);
		setTotalItems(0);
		setCurrentOffset(0);
	}
};
