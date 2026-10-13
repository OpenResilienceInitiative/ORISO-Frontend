// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../../../resources/i18n/en/common.json';
import { JoinRequestCenter } from './JoinRequestCenter';
import { GroupChatNotMember } from '../GroupChatNotMember';
import { useOwnJoinRequest } from './useOwnJoinRequest';
import { JoinRequestTransport } from './joinRequestTransport';
import { createHttpJoinRequestTransport } from './httpJoinRequestTransport';
import { M3SnackbarHost } from '../../m3Snackbar/M3SnackbarHost';
import { createSnackbarStack } from '../../m3Snackbar/snackbarStack';
import {
	knockRequest,
	knockRequesters,
	KNOCK_STORY_NOW
} from './__storybook__/joinRequestFixtures';

class BrowserRequest extends Request {
	constructor(input: RequestInfo | URL, init?: RequestInit) {
		super(input, { ...init, signal: undefined });
	}
}

const i18n = createInstance().use(initReactI18next);
const canvas = vi.hoisted(() => {
	const original = HTMLCanvasElement.prototype.getContext;
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () =>
			new Proxy(
				{},
				{
					get: (_target, key) =>
						key === 'measureText' ? () => ({ width: 0 }) : () => {}
				}
			)
	});
	return { original };
});
beforeEach(async () => {
	document.cookie = 'keycloak=synthetic-moderator-token';
	vi.stubGlobal('Request', BrowserRequest);
	await i18n.init({
		lng: 'en',
		fallbackLng: 'en',
		defaultNS: 'common',
		resources: { en: { common: en } },
		interpolation: { escapeValue: false }
	});
});
afterEach(() => {
	cleanup();
	document.cookie = 'keycloak=; Max-Age=0';
	vi.unstubAllGlobals();
});
afterAll(() => {
	HTMLCanvasElement.prototype.getContext = canvas.original;
});

it.each(['PARTICIPANT', 'CO_MODERATOR'] as const)(
	'an accepted public 204 reports queued %s admission rather than completed membership',
	async (role) => {
		const request = knockRequest(knockRequesters.anna, {
			id: 1,
			minutesAgo: 3
		});
		let accepted = false;
		const decisions: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (http: Request) => {
				expect(http.headers.get('Authorization')).toBe(
					'Bearer synthetic-moderator-token'
				);
				const path = new URL(http.url).pathname;
				if (
					http.method === 'GET' &&
					path === '/service/users/chat-series/join-requests'
				)
					return Response.json(accepted ? [] : [request]);
				if (
					http.method === 'POST' &&
					path ===
						'/service/users/chat-series/9101/join-requests/1/admit'
				) {
					decisions.push(await http.text());
					accepted = true;
					return new Response(null, { status: 204 });
				}
				throw new Error(
					`Unexpected synthetic HTTP boundary: ${http.method} ${path}`
				);
			})
		);
		const stack = createSnackbarStack();
		const transport = createHttpJoinRequestTransport();
		render(
			<I18nextProvider i18n={i18n}>
				<JoinRequestCenter
					transport={transport}
					stack={stack}
					now={KNOCK_STORY_NOW}
				/>
				<M3SnackbarHost stack={stack} />
			</I18nextProvider>
		);
		const card = await screen.findByRole('group', { name: 'Anna Berg' });
		if (role === 'CO_MODERATOR') {
			await userEvent.click(
				within(card).getByRole('button', { name: 'Details' })
			);
			const dialog = await screen.findByRole('dialog');
			await userEvent.click(
				within(dialog).getByRole('radio', { name: /Co-moderator/ })
			);
			await userEvent.click(
				within(dialog).getByRole('button', { name: 'Let in' })
			);
		} else
			await userEvent.click(
				within(card).getByRole('button', { name: 'Let in' })
			);
		await waitFor(() =>
			expect(
				screen.queryByRole('group', { name: 'Anna Berg' })
			).toBeNull()
		);
		expect(decisions).toEqual([JSON.stringify({ role })]);
		expect(
			within(screen.getByRole('region')).getByText(
				role === 'CO_MODERATOR'
					? "Anna Berg's co-moderation is approved. Group access still needs to be confirmed."
					: "Anna Berg's admission is approved. Group access still needs to be confirmed."
			)
		).toBeTruthy();
		expect(screen.queryByText('Anna Berg is now in the group.')).toBeNull();
	}
);

const Requester = ({
	transport,
	onOpen
}: {
	transport: JoinRequestTransport;
	onOpen: () => void;
}) => {
	const view = useOwnJoinRequest(
		9101,
		'synthetic-current-invite',
		transport,
		{ onOpenGroup: onOpen }
	);
	return <GroupChatNotMember onBack={() => {}} joinRequest={view} />;
};

it('a requester waits through public ADMITTING and opens the group only after public ADMITTED', async () => {
	let status = 'ADMITTING';
	const methods: string[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (http: Request) => {
			expect(new URL(http.url).pathname).toBe(
				'/service/users/chat-series/9101/join-requests/mine'
			);
			methods.push(http.method);
			return Response.json({
				id: 1,
				status,
				requestedAt: '2026-09-23T14:30:00Z'
			});
		})
	);
	const onOpen = vi.fn();
	const transport = createHttpJoinRequestTransport({ mineIntervalMs: 25 });
	render(
		<I18nextProvider i18n={i18n}>
			<Requester transport={transport} onOpen={onOpen} />
		</I18nextProvider>
	);
	await screen.findByText('Your request is approved.');
	expect(screen.getByRole('status').textContent).toBe(
		'Group access is still being completed. Keep this page open.'
	);
	expect(screen.queryByRole('button', { name: 'Ask to join' })).toBeNull();
	expect(
		screen.queryByRole('button', { name: 'Withdraw request' })
	).toBeNull();
	expect(screen.queryByRole('button', { name: 'Open group' })).toBeNull();
	status = 'ADMITTED';
	await userEvent.click(
		await screen.findByRole('button', { name: 'Open group' })
	);
	expect(onOpen).toHaveBeenCalledTimes(1);
	expect(screen.queryByText('Your request is approved.')).toBeNull();
	expect(methods.every((method) => method === 'GET')).toBe(true);
});

it.each([
	[
		'admit',
		403,
		'DPA_NEW_COUNSELLING_NOT_ALLOWED',
		'The counselling organisation must confirm the current data processing agreement. Contact your counselling centre. Counselling that has already begun can continue.'
	],
	[
		'admit',
		502,
		'DPA_POLICY_UNAVAILABLE',
		'The contract confirmation could not be checked right now. Please try again.'
	],
	[
		'admit',
		403,
		'ORDINARY_PERMISSION_REFUSAL',
		'That did not work. Please try again.'
	],
	[
		'decline',
		502,
		'DPA_POLICY_UNAVAILABLE',
		'That did not work. Please try again.'
	]
] as const)(
	'public %s %s/%s explains the failure without completing or losing the request',
	async (action, status, reason, expected) => {
		const request = knockRequest(knockRequesters.anna, {
			id: 1,
			minutesAgo: 3
		});
		let failed = true;
		let accepted = false;
		vi.stubGlobal(
			'fetch',
			vi.fn(async (http: Request) => {
				const path = new URL(http.url).pathname;
				if (
					http.method === 'GET' &&
					path === '/service/users/chat-series/join-requests'
				)
					return Response.json(accepted ? [] : [request]);
				if (
					http.method === 'POST' &&
					path ===
						`/service/users/chat-series/9101/join-requests/1/${action}`
				) {
					if (failed)
						return new Response(
							'synthetic-private-admission-detail',
							{ status, headers: { 'X-Reason': reason } }
						);
					accepted = true;
					return new Response(null, { status: 204 });
				}
				throw new Error(
					`Unexpected synthetic HTTP boundary: ${http.method} ${path}`
				);
			})
		);
		const stack = createSnackbarStack();
		render(
			<I18nextProvider i18n={i18n}>
				<JoinRequestCenter
					transport={createHttpJoinRequestTransport()}
					stack={stack}
					now={KNOCK_STORY_NOW}
				/>
				<M3SnackbarHost stack={stack} />
			</I18nextProvider>
		);
		await userEvent.click(
			within(
				await screen.findByRole('group', { name: 'Anna Berg' })
			).getByRole('button', {
				name: action === 'admit' ? 'Let in' : 'Decline'
			})
		);
		await within(screen.getByRole('region')).findByText(expected);
		const card = screen.getByRole('group', { name: 'Anna Berg' });
		expect(
			within(card)
				.getByRole('button', {
					name: action === 'admit' ? 'Let in' : 'Decline'
				})
				.hasAttribute('disabled')
		).toBe(false);
		expect(
			within(card)
				.getByRole('button', { name: 'Decline' })
				.hasAttribute('disabled')
		).toBe(false);
		expect(
			within(screen.getByRole('region')).queryByText(
				/admission is approved/
			)
		).toBeNull();
		expect(document.body.textContent).not.toContain(
			'synthetic-private-admission-detail'
		);
		await userEvent.click(
			within(screen.getByRole('region')).getByRole('button', {
				name: 'close'
			})
		);
		failed = false;
		await userEvent.click(
			within(screen.getByRole('group', { name: 'Anna Berg' })).getByRole(
				'button',
				{ name: action === 'admit' ? 'Let in' : 'Decline' }
			)
		);
		await within(screen.getByRole('region')).findByText(
			action === 'admit'
				? "Anna Berg's admission is approved. Group access still needs to be confirmed."
				: 'Request from Anna Berg declined.'
		);
		expect(screen.queryByRole('group', { name: 'Anna Berg' })).toBeNull();
	}
);
