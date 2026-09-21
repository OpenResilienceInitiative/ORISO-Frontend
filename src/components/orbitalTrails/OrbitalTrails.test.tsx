import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
	createOrbitalSystems,
	OrbitalTrails,
	type OrbitalSystem
} from './OrbitalTrails';

const flattenSystem = (system: OrbitalSystem) => [
	...system.angles,
	...system.increments
];

describe('OrbitalTrails', () => {
	it('creates four deterministic but independent orbital systems', () => {
		const first = createOrbitalSystems(17);
		const second = createOrbitalSystems(17);

		expect(first).toEqual(second);
		expect(first).toHaveLength(4);
		expect(
			new Set(first.map((system) => flattenSystem(system).join(','))).size
		).toBe(4);
	});

	it('draws one centred system that fills the canvas for the single loader', () => {
		const systems = createOrbitalSystems(17, 'single');

		expect(systems).toHaveLength(1);
		expect(systems[0].center).toEqual([240, 240]);
		const outer = Math.max(...systems[0].radii);
		/* Fills the canvas, and the outer orbit still fits inside it. */
		expect(outer).toBeGreaterThan(200);
		expect(240 + outer).toBeLessThanOrEqual(480);
	});

	it('keeps every orbit moving without exceeding the intended speed range', () => {
		const systems = createOrbitalSystems(29);
		const increments = systems.flatMap((system) => system.increments);

		expect(increments.every((value) => Math.abs(value) >= 0.012)).toBe(
			true
		);
		expect(increments.every((value) => Math.abs(value) <= 0.065)).toBe(
			true
		);
	});

	it('renders an accessible status around a decorative canvas', () => {
		const markup = renderToStaticMarkup(
			<OrbitalTrails
				label="Visualisierung wird aufgebaut"
				palette="mixed"
				seed={11}
			/>
		);

		expect(markup).toContain('role="status"');
		expect(markup).toContain('aria-label="Visualisierung wird aufgebaut"');
		expect(markup).toContain('<canvas');
		expect(markup).toContain('aria-hidden="true"');
		expect(markup).toContain('orbitalTrails--mixed');
	});
});
