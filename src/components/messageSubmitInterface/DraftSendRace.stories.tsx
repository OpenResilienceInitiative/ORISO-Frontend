import * as React from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ActiveSessionContext } from '../../globalState';
import { endpoints } from '../../resources/scripts/endpoints';
import { TipTapComposer, TipTapComposerRef } from './TipTapComposer';
import './TipTapComposer.styles.scss';
import { useDraftMessage } from './useDraftMessage';
import { hasDraftContent } from '../../services/draftStore';
import { buildMockActiveSession } from './__storybook__/composerStoryDecorator';

/** In-memory HTTP endpoint, with a PATCH that finishes after the send's DELETE. */
function SlowDraftBackend({ children }: { children: React.ReactNode }) {
	const [operations, setOperations] = useState<string[]>([]);
	useLayoutEffect(() => {
		const previous = window.fetch;
		const previousDraftUrl = endpoints.userDrafts;
		endpoints.userDrafts = new URL(
			previousDraftUrl,
			window.location.origin
		).href;
		const drafts = new Map<string, unknown>();
		window.fetch = async (input, init) => {
			const request = new Request(input, init);
			const url = new URL(request.url);
			if (
				!url.pathname.startsWith(
					new URL(endpoints.userDrafts, window.location.origin)
						.pathname
				)
			) {
				return previous(input, init);
			}
			const key = url.searchParams.get('scopeKey') || '';
			setOperations((previous) => [...previous, request.method]);
			if (request.method === 'PATCH') {
				const body = await request.json();
				await new Promise((resolve) => setTimeout(resolve, 1800));
				drafts.set(key, body);
				setOperations((previous) => [...previous, 'PATCH completed']);
				return new Response(null, { status: 204 });
			}
			if (request.method === 'DELETE') {
				drafts.delete(key);
				return new Response(null, { status: 204 });
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
			return drafts.has(key)
				? new Response(JSON.stringify(drafts.get(key)), {
						headers: { 'Content-Type': 'application/json' }
					})
				: new Response(null, { status: 204 });
		};
		return () => {
			window.fetch = previous;
			endpoints.userDrafts = previousDraftUrl;
		};
	}, []);
	return (
		<>
			{children}
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
						activeSession: buildMockActiveSession(),
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

export const DelayedSaveAfterSend: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor =
			canvasElement.querySelector<HTMLElement>('.ProseMirror')!;
		await userEvent.click(editor);
		await userEvent.keyboard('Practice reply sent successfully.');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Send reply' })
		);
		await new Promise((resolve) => setTimeout(resolve, 1350));
		await expect(
			canvas.getByRole('button', { name: 'Send reply' })
		).toBeDisabled();
		// Wait beyond the production composer's 1200 ms request reset, when
		// re-enabling the draft hook used to load the late PATCH back in.
		await waitFor(
			() =>
				expect(
					canvas.getByLabelText('Draft request sequence').textContent
				).toContain('PATCH completed'),
			{ timeout: 5000 }
		);
		await new Promise((resolve) => setTimeout(resolve, 1600));
		await waitFor(() => expect(editor.textContent?.trim()).toBe(''));
	}
};

export const NextReplyDuringSlowClear: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor =
			canvasElement.querySelector<HTMLElement>('.ProseMirror')!;
		await userEvent.click(editor);
		await userEvent.keyboard('Reply that was sent.');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Send reply' })
		);
		await waitFor(() => expect(editor.textContent?.trim()).toBe(''));
		await userEvent.click(editor);
		await userEvent.keyboard('Next unsent reply stays here.');
		await new Promise((resolve) => setTimeout(resolve, 1350));
		await expect(
			canvas.getByRole('button', { name: 'Send reply' })
		).toBeDisabled();
		await waitFor(
			() => {
				const sequence =
					canvas.getByLabelText('Draft request sequence')
						.textContent || '';
				expect(sequence.match(/PATCH completed/g)?.length).toBe(2);
			},
			{ timeout: 6000 }
		);
		await expect(editor.textContent?.trim()).toBe(
			'Next unsent reply stays here.'
		);
		await expect(
			canvas.getByRole('button', { name: 'Send reply' })
		).toBeEnabled();
	}
};
