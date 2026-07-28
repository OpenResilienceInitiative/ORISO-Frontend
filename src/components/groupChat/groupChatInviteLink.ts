export const buildGroupChatInviteLink = (
	loginUrl: string,
	seriesId: number
) => {
	const url = new URL(loginUrl);
	url.searchParams.set('gcid', String(seriesId));
	return url.toString();
};
