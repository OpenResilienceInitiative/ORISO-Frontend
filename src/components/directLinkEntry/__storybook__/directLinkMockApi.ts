/**
 * Storybook only: an in-memory stand-in for the direct-link endpoints of
 * ORISO-UserService#1479, installed on `fetch`, so the wired components run
 * their real requests. Every request is recorded for the play functions.
 */
import type {
	CallKnockStatus,
	DirectLinkDTO
} from '../../../api/apiDirectLinks';

export interface DirectLinkMockOptions {
	links?: DirectLinkDTO[];
	/** Status answers for `GET /call-knocks/mine/{id}`, one per poll; the last repeats. */
	knockAnswers?: CallKnockStatus[];
	/** `POST /directlinks` answers with this status (e.g. 500). */
	createStatus?: number;
	stats?: {
		numberOfAssignedSessions: number;
		numberOfActiveSessions: number;
		numberOfSentMessages: number;
	};
}

export interface DirectLinkMock {
	requests: { method: string; path: string; body?: unknown }[];
	links: DirectLinkDTO[];
	restore: () => void;
}

export const fixtureLink = (
	id: number,
	overrides: Partial<DirectLinkDTO> = {}
): DirectLinkDTO => ({
	id,
	token: `tok${id}`,
	url: `https://app.oriso.org/invite/tok${id}`,
	name: 'Flyer Schule',
	topicId: 4,
	topicName: 'Schulden',
	agencyId: 88,
	medium: 'VIDEO',
	temporary: true,
	active: true,
	admission: 'KNOCK',
	createDate: '2026-10-28T09:00:00Z',
	...overrides
});

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

let current: DirectLinkMock | null = null;

/** The mock of the running story, for play functions. */
export const directLinkMock = (): DirectLinkMock => {
	if (!current) throw new Error('directLinkMockApi is not installed');
	return current;
};

export const installDirectLinkMockApi = (
	options: DirectLinkMockOptions = {}
): (() => void) => {
	current?.restore();
	const original = globalThis.fetch;
	const links = [...(options.links ?? [])];
	const knockAnswers = [...(options.knockAnswers ?? ['PENDING'])];
	let knockId = 500;
	const requests: DirectLinkMock['requests'] = [];

	globalThis.fetch = async (input, init) => {
		const request = input instanceof Request ? input : null;
		const url = new URL(
			request ? request.url : String(input),
			window.location.origin
		);
		const method = (request?.method ?? init?.method ?? 'GET').toUpperCase();
		const path = url.pathname;
		const text = request
			? await request.clone().text()
			: typeof init?.body === 'string'
				? init.body
				: '';
		const body = text ? JSON.parse(text) : undefined;
		const record = () => requests.push({ method, path, body });

		if (path.endsWith('/service/users/directlinks')) {
			record();
			if (method === 'GET') return json(links);
			if (options.createStatus) return json({}, options.createStatus);
			const id = 100 + links.length;
			const link = fixtureLink(id, {
				name: body.name,
				topicId: body.topicId,
				topicName: body.name,
				medium: body.medium,
				temporary: Boolean(body.temporary),
				admission: body.medium === 'CHAT' ? 'DIRECT' : 'KNOCK'
			});
			links.unshift(link);
			return json(link, 201);
		}
		const patch = path.match(/\/service\/users\/directlinks\/(\d+)$/);
		if (patch) {
			record();
			const link = links.find((item) => item.id === Number(patch[1]));
			if (!link) return json({}, 404);
			Object.assign(link, body);
			return json(link);
		}
		if (path.includes('/service/users/statistics/consultant')) {
			record();
			return json({
				startDate: '2026-09-29',
				endDate: '2026-10-28',
				...(options.stats ?? {
					numberOfAssignedSessions: 6,
					numberOfActiveSessions: 14,
					numberOfSentMessages: 87
				})
			});
		}
		const start = path.match(/\/invitelinks\/([^/]+)\/conversations$/);
		if (start) {
			record();
			knockId += 1;
			return json({
				sessionId: 4711,
				matrixRoomId: '!direct:oriso.org',
				medium: 'VIDEO',
				admission: 'KNOCK',
				created: false,
				knockId,
				knockStatus: 'PENDING'
			});
		}
		const knock = path.match(/\/call-knocks\/mine\/(\d+)$/);
		if (knock) {
			record();
			if (method === 'DELETE') return new Response(null, { status: 204 });
			const status =
				knockAnswers.length > 1
					? knockAnswers.shift()!
					: knockAnswers[0];
			return json({
				id: Number(knock[1]),
				sessionId: 4711,
				status,
				medium: 'VIDEO',
				requestedAt: '2026-10-28T10:00:00Z'
			});
		}
		if (path.includes('/service/users/availability/')) {
			return new Response(null, { status: 200 });
		}
		return original(input, init);
	};

	current = {
		requests,
		links,
		restore: () => {
			globalThis.fetch = original;
			current = null;
		}
	};
	return current.restore;
};
