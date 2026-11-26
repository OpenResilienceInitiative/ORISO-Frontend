import { endpoints } from '../../../../../src/resources/scripts/endpoints';
import { sessionsReply } from '../../../sessions';

const usersSessionsApi = (cy, getWillReturn, setWillReturn) => {
	cy.intercept('GET', `${endpoints.sessionRooms}*`, (req) => {
		const data = getWillReturn('sessionRooms');
		const matrixRoomIds = (
			new URL(req.url).searchParams.get('roomIds[]') || ''
		)
			.split(',')
			.filter(Boolean);

		// Like the backend: one entry per requested room that the user has.
		// Since #2480 the list asks for all loaded rooms in one batch, so
		// answering with a fixed fixture session added a phantom list item.
		const known = [
			...(getWillReturn('askerSessions') || []),
			...(getWillReturn('consultantSessions') || [])
		].filter((item) => item?.session?.matrixRoomId);
		const found = known.filter((item) =>
			matrixRoomIds.includes(item.session.matrixRoomId)
		);

		if (!matrixRoomIds.length || !found.length || data?.statusCode >= 400) {
			return req.reply(data);
		}

		const [template] = data?.body?.sessions || [];
		req.reply({
			statusCode: 200,
			body: {
				sessions: found.map((item) =>
					template ? { ...template, ...item } : item
				)
			}
		});
	}).as('sessionRooms');

	// Lookup by numeric id (/room/<id>), used when a list item is opened.
	cy.intercept('GET', `${endpoints.sessionRooms}/*`, (req) => {
		const sessionId = Number(new URL(req.url).pathname.split('/').pop());
		const found = [
			...(getWillReturn('askerSessions') || []),
			...(getWillReturn('consultantSessions') || [])
		].find((item) => item?.session?.id === sessionId);
		if (!found) {
			return req.reply({ statusCode: 204 });
		}
		const [template] = getWillReturn('sessionRooms')?.body?.sessions || [];
		req.reply({
			sessions: [template ? { ...template, ...found } : found]
		});
	}).as('sessionRoomById');

	cy.intercept('GET', endpoints.askerSessions, (req) => {
		const sessionsRes = getWillReturn('askerSessions');
		if (sessionsRes?.statusCode) {
			return req.reply(sessionsRes);
		}

		req.reply({
			sessions: sessionsRes
		});
	}).as('askerSessions');

	cy.intercept('GET', `${endpoints.consultantSessions}*`, (req) => {
		const sessionsRes = getWillReturn('consultantSessions');

		if (sessionsRes?.statusCode) {
			return req.reply(sessionsRes);
		}

		const url = new URL(req.url);
		const offset = parseInt(url.searchParams.get('offset')) || 0;
		const count = parseInt(url.searchParams.get('count')) || 15;

		req.reply(
			sessionsReply({
				sessions: sessionsRes,
				offset,
				count
			})
		);
	}).as('consultantSessions');
};

export default usersSessionsApi;
