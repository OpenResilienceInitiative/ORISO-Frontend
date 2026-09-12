// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('./HandoverCarousel', () => ({
	HandoverCarousel: () => <div data-testid="carousel" />
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'registration.handover.headline': 'Geschafft.',
			'registration.handover.headlineAlmost': 'Fast geschafft.'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
}));

const { RegistrationHandover } = await import('./RegistrationHandover');

/**
 * Frank, 2026-09-01: "wir sollten aus dem 'Geschafft, so geht es weiter' ein
 * 'Fast geschafft' machen … und dann wenn 'Anfrage schreiben' fertig ist, dann
 * geht das 'Fast' eben da auch weg und es ist geschafft."
 *
 * Both lines are always in the DOM — they share one grid cell so the line
 * below never jumps — so the test asks which one is shown, not which one
 * exists. `aria-hidden` is the same answer a screen reader gets.
 */
const shown = (text: string) =>
	screen
		.getAllByText(text)
		.some((node) => node.getAttribute('aria-hidden') !== 'true');

describe('RegistrationHandover headline', () => {
	afterEach(cleanup);

	it('says "Fast geschafft." while the app is still preparing', () => {
		render(
			<RegistrationHandover
				ready={false}
				forcedState="preparing"
				onEnter={() => undefined}
			/>
		);

		expect(shown('Fast geschafft.')).toBe(true);
		expect(shown('Geschafft.')).toBe(false);
	});

	it('drops the "Fast" once the way on is free', () => {
		render(<RegistrationHandover ready onEnter={() => undefined} />);

		expect(shown('Geschafft.')).toBe(true);
		expect(shown('Fast geschafft.')).toBe(false);
	});

	it('leaves a caller-supplied headline alone', () => {
		render(
			<RegistrationHandover
				ready={false}
				forcedState="preparing"
				onEnter={() => undefined}
				copy={{ headline: 'Sie sind gleich dran.' }}
			/>
		);

		expect(shown('Sie sind gleich dran.')).toBe(true);
		expect(screen.queryByText('Fast geschafft.')).toBeNull();
	});
});
