// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionChannel } from '../../utils/channelRoute';
import { useThreadFocusReturn } from './useThreadFocusReturn';

afterEach(cleanup);
function Journey({ deepLinked = false }: { deepLinked?: boolean }) {
	const [channel, setChannel] = React.useState<SessionChannel | null>(
		deepLinked ? { kind: 'thread', rootId: 'root' } : null
	);
	const [sessionId, setSessionId] = React.useState('first');
	const [showRoot, setShowRoot] = React.useState(true);
	const timelineRef = React.useRef<HTMLDivElement>(null);
	const remember = useThreadFocusReturn({ channel, sessionId, timelineRef });
	return (
		<>
			<div ref={timelineRef}>
				{showRoot && (
					<div data-message-id="root">
						<button
							data-cy="thread-entry"
							onClick={(event) => {
								remember('root', event.currentTarget);
								setChannel({ kind: 'thread', rootId: 'root' });
							}}
						>
							Antworten öffnen
						</button>
					</div>
				)}
			</div>
			<button onClick={() => setChannel(null)}>Schließen</button>
			<button
				onClick={() => {
					setSessionId('second');
					setChannel(null);
				}}
			>
				Andere Sitzung
			</button>
			<button onClick={() => setChannel({ kind: 'supervision' })}>
				Supervision
			</button>
			<button onClick={() => setShowRoot(false)}>
				Nachricht entfernen
			</button>
		</>
	);
}
const click = (name: string) => {
	const button = screen.getByRole('button', { name });
	button.focus();
	fireEvent.click(button);
	return button;
};
describe('thread answers opener focus lifecycle', () => {
	it('returns to the answers opener when its thread closes', async () => {
		render(<Journey />);
		const opener = click('Antworten öffnen');
		click('Schließen');
		await waitFor(() => expect(document.activeElement).toBe(opener));
	});
	it('does not take focus from another session', async () => {
		render(<Journey />);
		click('Antworten öffnen');
		const navigation = click('Andere Sitzung');
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(document.activeElement).toBe(navigation);
	});
	it('forgets a thread opener when switching to another channel', async () => {
		render(<Journey />);
		click('Antworten öffnen');
		click('Supervision');
		const close = click('Schließen');
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(document.activeElement).toBe(close);
	});
	it('does not invent an opener for a deep-linked thread', async () => {
		render(<Journey deepLinked />);
		const close = click('Schließen');
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(document.activeElement).toBe(close);
	});
	it('leaves focus alone if the original message is no longer available', async () => {
		render(<Journey />);
		click('Antworten öffnen');
		click('Nachricht entfernen');
		const close = click('Schließen');
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(document.activeElement).toBe(close);
	});
});
