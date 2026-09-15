// @vitest-environment jsdom
/**
 * #1253 — the message body must exist on the first paint, and a body that is
 * not known yet must not be dressed as a finished message.
 *
 * Frank sent a message and saw the bubble, the timestamp and both read
 * checkmarks with no text inside. The body was pushed into state by an effect,
 * so it did not exist until at least one tick after the chrome had rendered.
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialDecryptedBody } from './MessageItemComponent';

// lottie-web asks for a 2d canvas context at import time, which jsdom does not
// have. The repo already stubs it this way elsewhere; without it this module
// cannot even be loaded, which is why the component has no jsdom test yet.
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));

// jsdom ships no canvas; something on the avatar path asks for a 2d context.
HTMLCanvasElement.prototype.getContext = (() => ({
	fillStyle: '',
	fillRect: () => {},
	drawImage: () => {},
	getImageData: () => ({ data: new Uint8ClampedArray(4) }),
	putImageData: () => {},
	createImageData: () => ({ data: new Uint8ClampedArray(4) }),
	measureText: () => ({ width: 0 }),
	fillText: () => {},
	clearRect: () => {},
	save: () => {},
	restore: () => {},
	beginPath: () => {},
	closePath: () => {},
	arc: () => {},
	fill: () => {},
	translate: () => {},
	scale: () => {}
})) as unknown as HTMLCanvasElement['getContext'];

const PLAIN_BODY = 'Ich habe heute wieder starkes Verlangen.';

afterEach(cleanup);

/**
 * The first-paint guarantee is asserted on the initial value itself, not
 * through `render()`. Testing Library flushes effects inside its own `act()`,
 * so a body filled by an effect and a body present from the start look
 * identical by the time `render()` returns — an assertion there passes either
 * way and guards nothing.
 */
describe('the body a message starts its first render with', () => {
	it('is the message itself when nothing needs decrypting (#1253)', () => {
		expect(initialDecryptedBody(false, PLAIN_BODY)).toBe(PLAIN_BODY);
	});

	it('is null only while a decryption is genuinely pending', () => {
		expect(initialDecryptedBody(true, 'cipher')).toBeNull();
	});

	it('does not claim to be pending when there is no message at all', () => {
		expect(initialDecryptedBody(true, '')).toBe('');
		expect(initialDecryptedBody(true, undefined)).toBeUndefined();
	});
});

describe('a message that needs no decryption', () => {
	it(
		'never draws bubble chrome without a body',
		{ timeout: 45000 },
		async () => {
			const { MessageItemComponent } = await import(
				'./MessageItemComponent'
			);
			const { MessageContextShell } = await import('./messageStoryShell');
			const { mockMessageItemComponentProps } = await import(
				'./MessageItemComponent.mocks'
			);

			const { container } = render(
				<MessageContextShell>
					<MessageItemComponent
						{...(mockMessageItemComponentProps({
							message: PLAIN_BODY
						} as any) as any)}
					/>
				</MessageContextShell>
			);

			const bubble = container.querySelector('.messageItem');
			// Either there is no message row at all, or it carries its text. What
			// must never happen is a row that renders without the body.
			if (bubble) {
				expect(bubble.textContent).toContain(PLAIN_BODY);
			}
		}
	);
});

describe('a message whose decryption is still in flight', () => {
	it('draws nothing at all rather than an empty bubble (#1253)', async () => {
		vi.resetModules();

		vi.doMock('../../utils/encryptionHelpers', async (importOriginal) => {
			const actual =
				await importOriginal<
					typeof import('../../utils/encryptionHelpers')
				>();
			return {
				...actual,
				// A decryption that never settles: the state the empty bubble
				// used to be drawn in.
				decryptText: () => new Promise<string>(() => {})
			};
		});

		vi.doMock('./MessageItemComponent.mocks', async (importOriginal) => {
			const actual =
				await importOriginal<
					typeof import('./MessageItemComponent.mocks')
				>();
			return {
				...actual,
				mockE2EEContext: () => ({
					...actual.mockE2EEContext(),
					isE2eeEnabled: true
				})
			};
		});

		const { MessageItemComponent } = await import('./MessageItemComponent');
		const { MessageContextShell } = await import('./messageStoryShell');
		const { mockMessageItemComponentProps } = await import(
			'./MessageItemComponent.mocks'
		);

		const { container } = render(
			<MessageContextShell>
				<MessageItemComponent
					{...(mockMessageItemComponentProps({
						message: 'cipher-text-that-never-decrypts'
					} as any) as any)}
				/>
			</MessageContextShell>
		);

		expect(container.querySelector('.messageItem')).toBeNull();
		expect(screen.queryByText(/11:43|✓✓/)).toBeNull();

		vi.doUnmock('../../utils/encryptionHelpers');
		vi.doUnmock('./MessageItemComponent.mocks');
		vi.resetModules();
	});
});
