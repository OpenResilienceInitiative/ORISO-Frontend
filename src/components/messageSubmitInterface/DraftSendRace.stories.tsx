import * as React from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	deleteCookieByName,
	getValueFromCookie,
	setValueInCookie
} from '../sessionCookie/accessSessionCookie';
import { unbindDraftCryptographyClient } from '../../services/draftCryptography';
import {
	initDraftKeys,
	installStoryFrameAccess
} from '../../../.storybook/draftCryptographyFixture';
import { ActiveSessionContext } from '../../globalState';
import { endpoints } from '../../resources/scripts/endpoints';
import { TipTapComposer, TipTapComposerRef } from './TipTapComposer';
import './TipTapComposer.styles.scss';
import { useDraftMessage } from './useDraftMessage';
import {
	hasDraftContent,
	REMOTE_DRAFT_INDEX_SCOPE
} from '../../services/draftStore';
import { buildMockActiveSession } from './__storybook__/composerStoryDecorator';

const activeSession = buildMockActiveSession();
const replyScope = `scope:${activeSession.item.id}|thread:main`;
const nextReply = 'Next unsent reply stays here.';
const draftPath = '/__storybook__/draft-send-race';
const empty = (status = 204) => new Response(null, { status });
const delay = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

type StoredDraft = {
	id: number;
	scopeKey: string;
	text: string;
	updatedAt: string;
};

/** In-memory 4S account data and a deliberately slow encrypted draft endpoint. */
function SlowDraftBackend({ children }: { children: React.ReactNode }) {
	const [operations, setOperations] = useState<string[]>([]);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<unknown>(null);
	useLayoutEffect(() => {
		if (
			getValueFromCookie('keycloak') ||
			getValueFromCookie('refreshToken')
		) {
			setError(
				new Error(
					'Draft story requires a preview without existing credentials'
				)
			);
			return;
		}
		const authCookiePath = window.location.pathname;
		const token = `fixture.${btoa(
			JSON.stringify({
				iss: 'https://storybook.invalid',
				sub: 'draft-race',
				sid: crypto.randomUUID()
			})
		)}.fixture`;
		const authorization = `Bearer ${token}`;
		const previousFetch = window.fetch;
		const previousDraftUrl = endpoints.userDrafts;
		const owner = {};
		const controller = new AbortController();
		const drafts = new Map<string, StoredDraft>();
		let removeFrameAccess = () => {};
		let nextId = 1;
		const record = (operation: string) =>
			setOperations((prior) => [...prior, operation]);

		let handleDraft:
			| ((request: Request, url: URL) => Promise<Response>)
			| null = null;
		window.fetch = async (input, init) => {
			const request = new Request(input, init);
			const url = new URL(request.url);
			const isFixture =
				url.origin === window.location.origin &&
				(url.pathname === draftPath ||
					url.pathname === `${draftPath}/single` ||
					url.pathname === `${draftPath}/protected`);
			const hasFixtureAuth =
				request.headers.get('Authorization') === authorization;
			if (!isFixture)
				return hasFixtureAuth ? empty(403) : previousFetch(input, init);
			return hasFixtureAuth && handleDraft
				? handleDraft(request, url)
				: empty(401);
		};

		const install = async () => {
			setValueInCookie('keycloak', token, authCookiePath);
			const cryptography = await initDraftKeys(owner, controller.signal);
			const reply = await cryptography.opaqueScope(replyScope);
			removeFrameAccess = installStoryFrameAccess(reply);
			const index = await cryptography.opaqueScope(
				REMOTE_DRAFT_INDEX_SCOPE
			);
			controller.signal.throwIfAborted();
			endpoints.userDrafts = new URL(
				draftPath,
				window.location.origin
			).href;
			handleDraft = async (request, url) => {
				const key = url.searchParams.get('scopeKey');
				const logicalScope =
					key === reply
						? replyScope
						: key === index
							? REMOTE_DRAFT_INDEX_SCOPE
							: null;
				if (
					request.method === 'GET' &&
					url.pathname === `${draftPath}/protected` &&
					key === null
				) {
					const page = Number(url.searchParams.get('page'));
					const perPage = Number(url.searchParams.get('perPage'));
					return Response.json({
						items:
							url.searchParams.get('legacyOnly') === 'true'
								? []
								: [...drafts.values()].slice(
										page * perPage,
										(page + 1) * perPage
									),
						page,
						perPage
					});
				}
				if (!key || !logicalScope) {
					record('Invalid draft scope');
					return empty(400);
				}
				const label = key === reply ? '' : ' index';
				if (
					request.method === 'PATCH' &&
					url.pathname === `${draftPath}/protected`
				) {
					const body = await request.json();
					if (
						Object.keys(body).length !== 1 ||
						typeof body.text !== 'string'
					) {
						record('Invalid draft envelope');
						return empty(400);
					}
					const clear = (await cryptography
						.open(key, body.text)
						.catch(() => null)) as {
						scopeKey?: unknown;
						text?: unknown;
					} | null;
					if (
						!clear ||
						typeof clear.text !== 'string' ||
						clear.scopeKey !== logicalScope
					) {
						record('Invalid draft envelope');
						return empty(400);
					}
					const patchLabel =
						key === reply &&
						clear.text.replace(/<[^>]*>/g, '') === nextReply
							? ' next reply'
							: label;
					record(`PATCH${patchLabel} started`);
					if (key === reply) await delay(1800);
					if (controller.signal.aborted) return empty(409);
					drafts.set(key, {
						id: drafts.get(key)?.id ?? nextId++,
						scopeKey: key,
						text: body.text,
						updatedAt: new Date().toISOString()
					});
					record(`PATCH${patchLabel} completed`);
					return empty();
				}
				if (
					request.method === 'DELETE' &&
					url.pathname === `${draftPath}/protected`
				) {
					drafts.delete(key);
					record(`DELETE${label}`);
					return empty();
				}
				if (
					request.method === 'GET' &&
					url.pathname === `${draftPath}/single`
				) {
					await delay(500);
					const row = drafts.get(key);
					return row ? Response.json(row) : empty();
				}
				return empty(405);
			};
			setReady(true);
		};
		void install().catch((reason: unknown) => {
			if (!controller.signal.aborted) setError(reason);
		});
		return () => {
			controller.abort();
			unbindDraftCryptographyClient(owner);
			removeFrameAccess();
			window.fetch = previousFetch;
			endpoints.userDrafts = previousDraftUrl;
			if (getValueFromCookie('keycloak') === token)
				deleteCookieByName('keycloak', authCookiePath);
		};
	}, []);
	if (error) throw error;
	return (
		<>
			{ready && children}
			<p style={{ padding: 32 }} aria-label="Draft request sequence">
				Draft request sequence: {operations.join(' → ')}
			</p>
		</>
	);
}

function DraftSendStage() {
	const [value, setValue] = useState('');
	const [sending, setSending] = useState(false);
	const [sent, setSent] = useState('');
	const ref = useRef<TipTapComposerRef>(null);
	const load = useCallback(
		(_state: unknown, text?: string) => setValue(text || ''),
		[]
	);
	const draft = useDraftMessage(!sending, load);
	const send = () => {
		setSending(true);
		setSent(ref.current?.getHTML() || '');
		setTimeout(() => {
			setValue('');
			ref.current?.clear();
			void Promise.allSettled([
				draft.clearDraftMessage(),
				new Promise<void>((resolve) => setTimeout(resolve, 1200))
			]).then(() => setSending(false));
		}, 50);
	};
	return (
		<div style={{ maxWidth: 720, padding: 32 }}>
			<h1>Sent message draft recovery</h1>
			<p>The draft save finishes after the message was sent.</p>
			{sent && <p>Sent message: {sent.replace(/<[^>]*>/g, '')}</p>}
			<div
				style={{
					height: 200,
					border: '1px solid var(--m3-outline, #777)'
				}}
			>
				<TipTapComposer
					ref={ref}
					value={value}
					placeholder="Write a reply"
					showToolbar={false}
					readOnly={false}
					onChange={(text) => {
						setValue(text);
						draft.onChange(text);
					}}
					onSubmitShortcut={send}
				/>
			</div>
			<button
				onClick={send}
				disabled={sending || !hasDraftContent(value)}
			>
				Send reply
			</button>
		</div>
	);
}

const meta = {
	title: 'Components/Message/DraftSendRace',
	parameters: { layout: 'fullscreen' },
	globals: { entryFormDemo: 'automatic', locale: 'de' },
	render: () => (
		<SlowDraftBackend>
			<ActiveSessionContext.Provider
				value={
					{
						activeSession,
						reloadActiveSession: () => {},
						readActiveSession: () => {}
					} as any
				}
			>
				<DraftSendStage />
			</ActiveSessionContext.Provider>
		</SlowDraftBackend>
	)
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const startSlowReply = async (canvasElement: HTMLElement, text: string) => {
	const canvas = within(canvasElement);
	const editor = await waitFor(() => {
		const element =
			canvasElement.querySelector<HTMLElement>('.ProseMirror');
		if (!element) throw new Error('The 4S draft fixture is still loading');
		return element;
	});
	const send = canvas.getByRole('button', { name: 'Send reply' });
	const sequence = canvas.getByLabelText('Draft request sequence');
	await userEvent.click(editor);
	await userEvent.keyboard(text);
	await waitFor(() => expect(sequence).toHaveTextContent('PATCH started'), {
		timeout: 5000
	});
	await userEvent.click(send);
	return { editor, send, sequence };
};

export const DelayedSaveAfterSend: Story = {
	play: async ({ canvasElement }) => {
		const { editor, send, sequence } = await startSlowReply(
			canvasElement,
			'Practice reply sent successfully.'
		);
		await delay(1350);
		await expect(send).toBeDisabled();
		await waitFor(
			() =>
				expect(sequence).toHaveTextContent('PATCH completed → DELETE'),
			{
				timeout: 5000
			}
		);
		// The next read finishes after the delayed write has been removed.
		await delay(1000);
		await expect(editor.textContent?.trim()).toBe('');
	}
};

export const NextReplyDuringSlowClear: Story = {
	play: async ({ canvasElement }) => {
		const { editor, send, sequence } = await startSlowReply(
			canvasElement,
			'Reply that was sent.'
		);
		await waitFor(() => expect(editor.textContent?.trim()).toBe(''));
		await userEvent.click(editor);
		await userEvent.keyboard(nextReply);
		await delay(1350);
		await expect(send).toBeDisabled();
		await waitFor(
			() =>
				expect(sequence).toHaveTextContent(
					'PATCH next reply completed'
				),
			{
				timeout: 6500
			}
		);
		await expect(editor.textContent?.trim()).toBe(nextReply);
		await expect(send).toBeEnabled();
	}
};
