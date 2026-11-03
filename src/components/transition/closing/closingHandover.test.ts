// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { transitionMotion } from '../transitionMotion';
import {
	CLOSING_HANDOVER_KEY,
	ClosingHandover,
	leaveClosingHandover,
	takeClosingHandover
} from './closingHandover';

const NOW = 1_800_000_000_000;

const handover = (
	overrides: Partial<ClosingHandover> = {}
): ClosingHandover => ({
	focal: 'messageField',
	at: NOW,
	...overrides
});

const stored = () => window.sessionStorage.getItem(CLOSING_HANDOVER_KEY);

/**
 * ORISO-Frontend#1737. The closing animation outlives the document that began
 * it: the old page leaves a short note, the new page picks it up once. The note
 * is only ever trusted when it is fresh and well-formed, because anything else
 * would put a cover over a page nobody is waiting for.
 */
describe('closing handover note', () => {
	afterEach(() => window.sessionStorage.clear());

	it('is picked up by the next document exactly as the old one left it', () => {
		leaveClosingHandover(window, handover());
		expect(takeClosingHandover(window, NOW + 300)).toEqual(handover());
	});

	it('is picked up only once, so a reload mid-reveal does not play it again', () => {
		leaveClosingHandover(window, handover());
		expect(takeClosingHandover(window, NOW)).not.toBeNull();
		expect(stored()).toBeNull();
		expect(takeClosingHandover(window, NOW)).toBeNull();
	});

	it('is empty when nothing was left', () => {
		expect(takeClosingHandover(window, NOW)).toBeNull();
	});

	it('expires with the longest the animation may cover the page', () => {
		const { capMs } = transitionMotion.closing;
		leaveClosingHandover(window, handover());
		expect(takeClosingHandover(window, NOW + capMs)).not.toBeNull();

		leaveClosingHandover(window, handover());
		expect(takeClosingHandover(window, NOW + capMs + 1)).toBeNull();
		expect(stored(), 'an expired note is thrown away').toBeNull();
	});

	it('is not trusted from the future either (a clock that jumped)', () => {
		const { capMs } = transitionMotion.closing;
		leaveClosingHandover(window, handover({ at: NOW + capMs + 1 }));
		expect(takeClosingHandover(window, NOW)).toBeNull();
		expect(stored()).toBeNull();
	});

	it.each([
		['not JSON', 'not json'],
		['null', 'null'],
		['not an object', '"curtain"'],
		[
			'an unknown destination',
			JSON.stringify(handover({ focal: 'sky' as never }))
		],
		['no time', JSON.stringify({ ...handover(), at: undefined })],
		[
			'a time that is not a number',
			JSON.stringify({ ...handover(), at: 'now' })
		],
		[
			'a time written as text',
			JSON.stringify({ ...handover(), at: String(NOW) })
		]
	])('is ignored and thrown away when it holds %s', (_name, raw) => {
		window.sessionStorage.setItem(CLOSING_HANDOVER_KEY, raw);
		expect(takeClosingHandover(window, NOW)).toBeNull();
		expect(stored()).toBeNull();
	});

	describe('the tenant colour it carries', () => {
		const colors = { primary: '#0050a0' };

		it('is handed over with it, because the next document starts before the palette arrives', () => {
			leaveClosingHandover(window, handover({ colors }));
			expect(takeClosingHandover(window, NOW)?.colors).toEqual(colors);
		});

		it('may be absent: the platform colour applies', () => {
			leaveClosingHandover(window, handover());
			const taken = takeClosingHandover(window, NOW);
			expect(taken).not.toBeNull();
			expect(taken).not.toHaveProperty('colors');
		});

		it.each([
			['a url', 'url(https://example.org/x.png)'],
			['a second declaration', '#fff; background: url(x)'],
			['a word', 'expression'],
			['far too long', `rgb(${'0, '.repeat(30)}0)`],
			['empty', '']
		])(
			'is dropped when it is %s, and the animation still plays',
			(_name, bad) => {
				leaveClosingHandover(
					window,
					handover({ colors: { primary: bad } })
				);
				const taken = takeClosingHandover(window, NOW);
				expect(taken).not.toBeNull();
				expect(taken).not.toHaveProperty('colors');
			}
		);

		it('is taken in the notations a browser computes, not only hex', () => {
			for (const colour of [
				'#fff',
				'#00305f',
				'#00305fcc',
				'rgb(0, 48, 95)',
				'rgba(0, 48, 95, 0.5)',
				'hsl(210 100% 19%)',
				'oklch(0.4 0.1 250)',
				'color(srgb 0 0.19 0.37)'
			]) {
				const colors = { primary: colour };
				leaveClosingHandover(window, handover({ colors }));
				expect(takeClosingHandover(window, NOW)?.colors).toEqual(
					colors
				);
			}
		});

		it('is dropped when it is not text', () => {
			window.sessionStorage.setItem(
				CLOSING_HANDOVER_KEY,
				JSON.stringify({
					...handover(),
					colors: { primary: 7 }
				})
			);
			const taken = takeClosingHandover(window, NOW);
			expect(taken).not.toBeNull();
			expect(taken).not.toHaveProperty('colors');
		});
	});

	it('survives a browser that refuses storage: nothing is left, nothing is thrown', () => {
		const refusing = {
			get sessionStorage(): Storage {
				throw new DOMException('denied', 'SecurityError');
			}
		} as unknown as Window;
		expect(() => leaveClosingHandover(refusing, handover())).not.toThrow();
		expect(takeClosingHandover(refusing, NOW)).toBeNull();
	});

	it('does not touch the storage any further when nothing was left', () => {
		const removeItem = vi.fn();
		const empty = {
			sessionStorage: { getItem: () => null, removeItem }
		} as unknown as Window;
		expect(takeClosingHandover(empty, NOW)).toBeNull();
		expect(removeItem).not.toHaveBeenCalled();
	});

	it('survives a storage that is full', () => {
		const full = {
			sessionStorage: {
				setItem: () => {
					throw new DOMException('full', 'QuotaExceededError');
				},
				getItem: () => null,
				removeItem: () => undefined
			}
		} as unknown as Window;
		expect(() => leaveClosingHandover(full, handover())).not.toThrow();
	});
});
