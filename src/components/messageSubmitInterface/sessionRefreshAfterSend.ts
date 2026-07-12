type SessionRefreshAfterSendInput = {
	isMatrixSession: boolean;
	clientRoomId?: string | null;
};

export const shouldReloadSessionAfterSend = ({
	isMatrixSession,
	clientRoomId
}: SessionRefreshAfterSendInput): boolean =>
	isMatrixSession && !clientRoomId;

export const reloadSessionAfterSendIfNeeded = (
	input: SessionRefreshAfterSendInput,
	reload?: () => void
): void => {
	if (shouldReloadSessionAfterSend(input)) {
		reload?.();
	}
};
