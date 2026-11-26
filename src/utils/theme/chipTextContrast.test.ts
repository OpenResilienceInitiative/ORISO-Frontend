import { expect, it } from 'vite-plus/test';
import { computeOrisoPalette } from './orisoScheme';
import { wcagContrast } from './wcagContrast';

it('keeps the 12px other-centre chip at AA on the default light palette', () => {
	const { tokens } = computeOrisoPalette({ primary: '#a5000a' }, 'light');
	const label = tokens['--m3-on-secondary-container'];
	const background = tokens['--m3-secondary-container'];
	expect(wcagContrast(label, background)).toBeGreaterThanOrEqual(4.5);
});
