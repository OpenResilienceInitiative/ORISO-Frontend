import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ATMOSPHERE_NAMES, Atmosphere } from './Atmosphere';

/**
 * The living backdrop, ported verbatim from the handoff's `pond.js`.
 *
 * Soft masses of colour drift against each other on a very slow clock; some
 * worlds carry blurred bands that swell along their run, a river seen from
 * above. Canvas 2D, no shader, no library, about 7 kB.
 *
 * It does **not** react to speech. That was tried during the design and
 * dropped: ripples on speech read as noise in a room where someone is talking
 * about something difficult. Under `prefers-reduced-motion` it renders a
 * single still frame rather than animating slowly.
 *
 * The atmosphere is chosen centrally by the counselling centre. An advice
 * seeker never picks one, and a counsellor only selects from what the centre
 * has configured.
 */
const meta: Meta<typeof Atmosphere> = {
	title: 'Call/Atmosphere',
	component: Atmosphere,
	parameters: { layout: 'fullscreen' }
};

export default meta;
type Story = StoryObj<typeof Atmosphere>;

const Frame = ({ palette }: { palette: string }) => (
	<figure style={{ margin: 0 }}>
		<div
			style={{
				position: 'relative',
				inlineSize: 280,
				blockSize: 170,
				borderRadius: 12,
				overflow: 'hidden'
			}}
		>
			<Atmosphere palette={palette as never} />
		</div>
		<figcaption
			style={{
				font: '500 12px/20px Inter, system-ui, sans-serif',
				color: '#444748',
				paddingBlockStart: 6
			}}
		>
			{palette}
		</figcaption>
	</figure>
);

/** All eleven worlds the ported file defines. */
export const AlleWelten: Story = {
	render: () => (
		<div
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: 20,
				padding: 24
			}}
		>
			{ATMOSPHERE_NAMES.map((name) => (
				<Frame key={name} palette={name} />
			))}
		</div>
	)
};

/** One at full size, the way a stage actually carries it. */
export const Buehne: Story = {
	render: () => (
		<div style={{ position: 'relative', inlineSize: 900, blockSize: 560 }}>
			<Atmosphere palette="fluss" />
		</div>
	)
};

/** The two that are deliberately still — a choice, not an omission. */
export const Still: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 20, padding: 24 }}>
			<Frame palette="ruhe" />
			<Frame palette="duene" />
		</div>
	)
};

/** The two dark worlds, for an evening consultation. */
export const Dunkel: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 20, padding: 24 }}>
			<Frame palette="nacht" />
			<Frame palette="lagerfeuer" />
		</div>
	)
};

/*
 * TICKET 05 ACCEPTANCE — the loop rules.
 *
 * `Atmosphere.test.tsx` names these rules in its header and asserts none of
 * them, because it cannot: jsdom has no 2D canvas context, so the element
 * never gets past its constructor there. They are browser facts and this is
 * the suite that runs in a real browser.
 *
 * Two observables, because one of them cannot see what it looks like it can.
 *
 * The element's clock `t` is WALL-TIME based — `dt` comes from
 * `performance.now()` minus the last tick, and each tick resets the last
 * tick. That is deliberate (identical motion on a 60Hz and a 120Hz display)
 * and it has a consequence worth writing down: a second rAF chain running in
 * the same frame sees `dt` of almost zero, so the clock does NOT double when
 * a loop leaks. Measured: with both of the element's protections removed,
 * twenty leaked chains still advance `t` at the normal rate. A clock-rate
 * check is therefore the wrong instrument for a leak, and this file used one
 * until the mutation run said otherwise.
 *
 * So the leak check counts rAF scheduling instead: each live chain calls
 * `requestAnimationFrame` exactly once per frame, so N chains make N calls
 * per frame and the ratio before/after the switches IS the number of chains.
 * The clock rate is still used, but only for what it genuinely shows — that
 * the element is animating, has stopped, or has started again.
 */

/** The element's own fields. Plain properties on the custom element. */
interface PondElement extends HTMLElement {
	running?: boolean;
	t: number;
}

/** Everything but the two deliberately still ones. */
const ANIMATED = ATMOSPHERE_NAMES.filter((n) => n !== 'ruhe' && n !== 'duene');

const upgraded = async (root: HTMLElement): Promise<PondElement> => {
	const { waitFor } = await import('storybook/test');
	return waitFor(() => {
		const el = root.querySelector('oriso-pond') as PondElement | null;
		// The import that registers the element is dynamic, so there is a
		// tick where the tag exists but is not yet an OrisoPond.
		if (!el || el.t === undefined) throw new Error('noch nicht upgraded');
		return el;
	});
};

/**
 * Clock units per wall-clock second. One running loop gives about 2.
 *
 * This answers "is it animating?", not "how many loops are there?" — see the
 * note above.
 */
const clockRate = async (pond: PondElement): Promise<number> => {
	const t0 = pond.t;
	const w0 = performance.now();
	await new Promise((resolve) => setTimeout(resolve, 500));
	return (pond.t - t0) / ((performance.now() - w0) / 1000);
};

/**
 * How many times `requestAnimationFrame` is scheduled per frame.
 *
 * One chain reschedules itself once per frame, so this is the number of live
 * chains — which is the thing the ticket actually asks about.
 */
const chainsRunning = async (): Promise<number> => {
	const real = window.requestAnimationFrame.bind(window);
	let scheduled = 0;
	let frames = 0;
	window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
		scheduled += 1;
		return real(cb);
	}) as typeof window.requestAnimationFrame;
	// A chain of our own, to count the frames the others were scheduling in.
	// It goes through `real`, so it never lands in `scheduled` and does not
	// have to be subtracted back out.
	const countFrames = () => {
		frames += 1;
		own = real(countFrames);
	};
	let own = real(countFrames);
	await new Promise((resolve) => setTimeout(resolve, 500));
	window.cancelAnimationFrame(own);
	window.requestAnimationFrame = real;
	return frames === 0 ? 0 : scheduled / frames;
};

/**
 * One rAF loop per stage, and twenty preset switches do not leak a second.
 *
 * The ticket asks for exactly this check — "switching presets does not leak a
 * loop (check with 20 switches)" — because an earlier version of the element
 * double-started and ran at double speed.
 */
export const Schleifenpruefung: Story = {
	name: 'Schleifenprüfung (Ticket 05)',
	render: () => (
		<div style={{ position: 'relative', inlineSize: 320, blockSize: 200 }}>
			<Atmosphere palette="fluss" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const { expect } = await import('storybook/test');
		const pond = await upgraded(canvasElement);

		await expect(pond.running).toBe(true);
		await expect(await clockRate(pond)).toBeGreaterThan(0.5);

		// One stage, one loop.
		const before = await chainsRunning();
		await expect(before).toBeGreaterThan(0.6);
		await expect(before).toBeLessThan(1.4);

		for (let i = 0; i < 20; i += 1)
			pond.setAttribute('palette', ANIMATED[i % ANIMATED.length]);

		// Still one. Twenty leaked chains would put this near 21.
		const after = await chainsRunning();
		await expect(after).toBeLessThan(1.4);
		// And still actually running, rather than passing by standing still.
		await expect(after).toBeGreaterThan(0.6);
	}
};

/** A still preset stops the clock, and switching back starts exactly one. */
export const StillUndZurueck: Story = {
	name: 'Still und zurück (Ticket 05)',
	render: () => (
		<div style={{ position: 'relative', inlineSize: 320, blockSize: 200 }}>
			<Atmosphere palette="fluss" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const { expect } = await import('storybook/test');
		const pond = await upgraded(canvasElement);

		pond.setAttribute('palette', 'ruhe');
		await expect(await clockRate(pond)).toBeLessThan(0.2);

		pond.setAttribute('palette', 'fluss');
		const back = await clockRate(pond);
		await expect(back).toBeGreaterThan(0.5);
		await expect(back).toBeLessThan(3);
	}
};

/** `stop()` on disconnect — an element off the page must not keep a loop. */
export const HaeltAnBeimEntfernen: Story = {
	name: 'Hält an beim Entfernen (Ticket 05)',
	render: () => (
		<div style={{ position: 'relative', inlineSize: 320, blockSize: 200 }}>
			<Atmosphere palette="fluss" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const { expect, waitFor } = await import('storybook/test');
		const pond = await upgraded(canvasElement);
		await expect(pond.running).toBe(true);

		pond.remove();
		await waitFor(() => expect(pond.running).toBe(false));
		await expect(await clockRate(pond)).toBeLessThan(0.2);
	}
};
