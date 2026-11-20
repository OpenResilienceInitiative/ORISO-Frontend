// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FutureZone, FutureZoneExtraRow } from './FutureZone';

const now = new Date('2026-11-12T10:00:00Z');

const row = (key: string, start: string, end?: string): FutureZoneExtraRow => ({
	key,
	start: new Date(start),
	end: end ? new Date(end) : undefined,
	render: () => <span data-testid="extra">{key}</span>
});

describe('FutureZone extra rows', () => {
	it('places extra rows by time, furthest first, and drops ended ones', () => {
		render(
			<FutureZone
				entries={[]}
				extraRows={[
					row('tomorrow', '2026-11-13T09:00:00Z'),
					row(
						'ended',
						'2026-11-11T09:00:00Z',
						'2026-11-11T10:00:00Z'
					),
					row('next-week', '2026-11-19T09:00:00Z'),
					row(
						'running',
						'2026-11-12T09:00:00Z',
						'2026-11-12T11:00:00Z'
					)
				]}
				role="asker"
				listHeight={600}
				fixedNow={now}
			/>
		);
		expect(
			screen.getAllByTestId('extra').map((element) => element.textContent)
		).toEqual(['next-week', 'tomorrow', 'running']);
	});
});
