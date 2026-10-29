import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeOrisoPalette } from '../../../utils/theme/orisoScheme';

/**
 * #1499: the clock hands and the "+" are the brand colour — Frank, 23.09.:
 * "nutze anstatt on-primary bitte einfach primary". They resolve through
 * `--oriso-primary-text` (#1528: the primary, darkened only when it is too
 * light to read), with `--m3-primary` as the fallback.
 * The faces stay light so that ink reaches 3:1 on every one of them.
 */

const styles = readFileSync(
	join(__dirname, 'waitingAreaCountdown.styles.scss'),
	'utf8'
);

const channel = (v: number) =>
	v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const luminance = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((i) =>
		channel(parseInt(hex.slice(i, i + 2), 16) / 255)
	);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
};

/** The three light ends of the face gradients the hands are drawn on. */
const FACES = [
	'--m3-surface-container-high',
	'--m3-surface-container-lowest',
	'--m3-primary-fixed'
];

const weakest = (seed: string, ink?: string) => {
	const { tokens } = computeOrisoPalette({ primary: seed }, 'light');
	const hand = ink ?? tokens['--m3-primary'];
	return Math.min(...FACES.map((face) => contrast(hand, tokens[face])));
};

describe('waiting clock colours', () => {
	it('draws hands and "+" in the brand colour, via #1528\'s text token', () => {
		expect(styles).toContain(
			'$clock-ink: var(--oriso-primary-text, var(--m3-primary, #a5000a));'
		);
		expect(styles).toMatch(/&__hand \{[^}]*background: \$clock-ink;/);
		expect(styles).toMatch(/&__plus \{[^}]*color: \$clock-ink;/);
	});

	it.each(['#cc1e1c', '#a5000a', '#2e7d32'])(
		'%s: the plain primary already reaches 3:1 on every face',
		(seed) => {
			expect(weakest(seed)).toBeGreaterThanOrEqual(3);
		}
	);

	it('#b4ddee: the palette text tone reaches 3:1 on every face', () => {
		const { tokens } = computeOrisoPalette({ primary: '#b4ddee' }, 'light');
		expect(
			weakest('#b4ddee', tokens['--oriso-primary-text'])
		).toBeGreaterThanOrEqual(3);
	});

	it('#b4ddee: the pastel primary alone is too light, hence the text token', () => {
		expect(weakest('#b4ddee')).toBeLessThan(3);
	});
});
