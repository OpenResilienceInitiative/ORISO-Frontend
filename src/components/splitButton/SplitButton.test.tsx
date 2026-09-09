// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SplitButton } from './SplitButton';

afterEach(cleanup);

describe('SplitButton size scale', () => {
	it('marks the Figma xsmall geometry on the shared atom', () => {
		const { container } = render(
			<SplitButton
				size="xsmall"
				label="Alle"
				onClick={vi.fn()}
				onToggleMenu={vi.fn()}
				menuLabel="Empfängermenü öffnen"
			/>
		);

		expect((container.firstChild as HTMLElement).classList).toContain(
			'splitButton--xsmall'
		);
	});

	it('marks an upward-opening menu without changing the default direction', () => {
		const upward = render(
			<SplitButton
				label="Alle"
				onToggleMenu={vi.fn()}
				menuLabel="Empfängermenü öffnen"
				menuDirection="up"
			/>
		);
		expect(
			(upward.container.firstChild as HTMLElement).classList
		).toContain('splitButton--menuUp');
		upward.unmount();

		const downward = render(
			<SplitButton
				label="Datum"
				onToggleMenu={vi.fn()}
				menuLabel="Datumsmenü öffnen"
			/>
		);
		expect(
			(downward.container.firstChild as HTMLElement).classList
		).not.toContain('splitButton--menuUp');
	});
});
