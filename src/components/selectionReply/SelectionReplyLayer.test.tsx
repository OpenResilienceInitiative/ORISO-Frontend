// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';

import { SelectionReplyLayer } from './SelectionReplyLayer';
import type { MessageSelection } from './useMessageSelection';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const selection = (): MessageSelection => {
	const range = document.createRange();
	range.selectNodeContents(document.body);
	return {
		passage: { eventId: '$1', author: 'Anna', text: 'Freiburg' },
		anchor: {
			top: 10,
			bottom: 30,
			centerX: 200,
			layerWidth: 400,
			visibleTop: 0,
			visibleBottom: 600
		},
		range
	};
};

const renderLayer = (recorder: {
	start: () => Promise<void>;
	stop: () => Promise<{ src: string; durationSec: number }>;
	cancel: () => void;
}) =>
	render(
		<SelectionReplyLayer
			authorFor={() => 'Anna'}
			onAddToComposer={() => {}}
			onSendNow={() => {}}
			recorder={recorder}
			initialSelection={selection()}
			initialMode="toolbar"
		>
			<div data-message-id="$1">
				<div className="messageItem__message">
					<p data-testid="body">Ich wohne in Freiburg.</p>
				</div>
			</div>
		</SelectionReplyLayer>
	);

const startVoiceFromToolbar = () =>
	fireEvent.click(
		screen.getAllByLabelText('message.selectionReply.replyVoice')[0]
	);

describe('SelectionReplyLayer voice recording', () => {
	afterEach(cleanup);

	it('a start that finishes after the reply closed is cancelled', async () => {
		const start = deferred<void>();
		const recorder = {
			start: vi.fn(() => start.promise),
			stop: vi.fn(),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		fireEvent.click(screen.getByLabelText('message.selectionReply.cancel'));
		await act(async () => start.resolve());
		expect(recorder.cancel).toHaveBeenCalled();
		expect(
			document.querySelector('[data-cy="selection-reply-popover"]')
		).toBeNull();
	});

	it('a second press while the microphone starts does not start it again', async () => {
		const start = deferred<void>();
		const recorder = {
			start: vi.fn(() => start.promise),
			stop: vi.fn(),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		startVoiceFromToolbar();
		await act(async () => start.resolve());
		expect(recorder.start).toHaveBeenCalledTimes(1);
		expect(recorder.cancel).not.toHaveBeenCalled();
	});

	it('a start from a closed reply does not cancel the next take', async () => {
		const first = deferred<void>();
		const events: string[] = [];
		const recorder = {
			start: vi.fn(() => {
				events.push('start');
				return recorder.start.mock.calls.length === 1
					? first.promise
					: Promise.resolve();
			}),
			stop: vi.fn(),
			cancel: vi.fn(() => events.push('cancel'))
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		fireEvent.click(screen.getByLabelText('message.selectionReply.cancel'));
		// Mark the passage again and start a new take.
		const text = screen.getByTestId('body').firstChild!;
		const range = document.createRange();
		range.setStart(text, 0);
		range.setEnd(text, 9);
		window.getSelection()!.removeAllRanges();
		window.getSelection()!.addRange(range);
		vi.useFakeTimers();
		await act(async () => {
			screen
				.getByTestId('body')
				.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
			vi.runAllTimers();
		});
		vi.useRealTimers();
		startVoiceFromToolbar();
		await act(async () => first.resolve());
		await act(async () => {
			await new Promise((done) => setTimeout(done, 0));
		});
		expect(events.lastIndexOf('cancel')).toBeLessThan(
			events.lastIndexOf('start')
		);
		expect(recorder.start).toHaveBeenCalledTimes(2);
		expect(screen.getByLabelText('app.stop')).toBeTruthy();
	});

	it('a microphone that fails to start shows an error, the field stays usable', async () => {
		const start = deferred<void>();
		const recorder = {
			start: vi.fn(() => start.promise),
			stop: vi.fn(),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		await act(async () => start.reject(new Error('denied')));
		expect(screen.getByRole('alert').textContent).toContain(
			'voice.recording.error.headline'
		);
		expect(
			(
				screen.getByLabelText(
					'message.selectionReply.inputLabel'
				) as HTMLInputElement
			).disabled
		).toBe(false);
	});

	it('a take that fails to save shows an error and unlocks the field', async () => {
		const stop = deferred<{ src: string; durationSec: number }>();
		const recorder = {
			start: vi.fn(async () => {}),
			stop: vi.fn(() => stop.promise),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		await act(async () => {});
		const input = screen.getByLabelText(
			'message.selectionReply.inputLabel'
		) as HTMLInputElement;
		expect(input.disabled).toBe(true);
		fireEvent.click(screen.getByLabelText('app.stop'));
		await act(async () => stop.reject(new Error('broken')));
		expect(screen.getByRole('alert')).toBeTruthy();
		expect(input.disabled).toBe(false);
	});
});
