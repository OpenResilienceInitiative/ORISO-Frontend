// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoicePlayer } from './VoicePlayer';
import { formatClock, getTileLayout } from './voicePlayerLayout';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options
				? `${key}:${Object.entries(options)
						.map(([k, v]) => `${k}=${v}`)
						.join(',')}`
				: key
	})
}));

afterEach(cleanup);

describe('getTileLayout', () => {
	it('renders one tile per second up to the cap', () => {
		expect(getTileLayout(12, 'md')).toMatchObject({
			count: 12,
			secondsPerTile: 1,
			isSectioned: false
		});
	});

	it('caps at 16 sections and reports the seconds per tile', () => {
		const layout = getTileLayout(160, 'md');
		expect(layout.count).toBe(16);
		expect(layout.secondsPerTile).toBe(10);
		expect(layout.isSectioned).toBe(true);
	});

	it('caps narrow columns at 10 sections', () => {
		expect(getTileLayout(12, 'sm').count).toBe(10);
		expect(getTileLayout(9, 'sm').count).toBe(9);
	});

	it('never collapses to zero tiles', () => {
		expect(getTileLayout(0.2, 'md').count).toBe(1);
		expect(getTileLayout(0, 'md').count).toBe(1);
	});
});

describe('formatClock', () => {
	it.each([
		[0, '0:00'],
		[9, '0:09'],
		[12, '0:12'],
		[65, '1:05'],
		[165, '2:45']
	])('formats %ss as %s', (input, expected) => {
		expect(formatClock(input)).toBe(expected);
	});

	it('clamps negative and non-finite values', () => {
		expect(formatClock(-5)).toBe('0:00');
		expect(formatClock(Number.NaN)).toBe('0:00');
	});
});

describe('VoicePlayer, tiles variant', () => {
	it('renders one seekable tile per second and the clock', () => {
		const { container } = render(<VoicePlayer durationSec={12} />);

		expect(container.querySelectorAll('.voicePlayer__tile')).toHaveLength(
			12
		);
		expect(screen.getByText('0:00 / 0:12')).toBeTruthy();
	});

	it('marks tiles as played once the position passes them', () => {
		const { container } = render(
			<VoicePlayer durationSec={12} initialProgress={0.5} />
		);

		// 6 s in: tiles starting at 0…5 s are played, the rest are not.
		expect(
			container.querySelectorAll('.voicePlayer__tile--played')
		).toHaveLength(6);
	});

	it('seeks the audio element when a tile is clicked', () => {
		const { container } = render(<VoicePlayer durationSec={12} />);
		const audio = container.querySelector('audio') as HTMLAudioElement;

		fireEvent.click(container.querySelectorAll('.voicePlayer__tile')[4]);

		expect(audio.currentTime).toBe(4);
		expect(screen.getByText('0:04 / 0:12')).toBeTruthy();
	});

	it('names the seconds per tile once the recording is sectioned', () => {
		render(<VoicePlayer durationSec={165} />);

		expect(
			screen.getByText('voicePlayer.meta.perTile:total=2:45,seconds=10')
		).toBeTruthy();
	});

	it('appends the note to the meta line', () => {
		render(<VoicePlayer durationSec={14} note="noch nicht angehört" />);

		expect(screen.getByText(/noch nicht angehört$/)).toBeTruthy();
	});

	it('hides the meta line when showMeta is false', () => {
		const { container } = render(
			<VoicePlayer durationSec={12} showMeta={false} />
		);

		expect(container.querySelector('.voicePlayer__meta')).toBeNull();
	});
});

describe('VoicePlayer, ring variant', () => {
	it('draws progress as the ring angle', () => {
		const { container } = render(
			<VoicePlayer
				variant="ring"
				durationSec={12}
				initialProgress={0.25}
			/>
		);
		const toggle = container.querySelector(
			'.voicePlayer__toggle'
		) as HTMLElement;

		expect(
			toggle.style.getPropertyValue('--voice-player-ring-progress')
		).toBe('90deg');
	});

	it('renders no tiles', () => {
		const { container } = render(
			<VoicePlayer variant="ring" durationSec={12} />
		);

		expect(container.querySelectorAll('.voicePlayer__tile')).toHaveLength(
			0
		);
	});

	it('reveals sender and time on hover', () => {
		const { container } = render(
			<VoicePlayer
				variant="ring"
				durationSec={12}
				sender="sanftes Alpaka Kim"
				sentAt="14:32"
			/>
		);
		const toggle = container.querySelector(
			'.voicePlayer__toggle'
		) as HTMLElement;

		expect(screen.queryByRole('tooltip')).toBeNull();

		fireEvent.mouseEnter(toggle);
		expect(screen.getByRole('tooltip').textContent).toContain(
			'sanftes Alpaka Kim · 14:32'
		);

		fireEvent.mouseLeave(toggle);
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('falls back to the encryption note when no sender is given', () => {
		const { container } = render(
			<VoicePlayer variant="ring" durationSec={12} />
		);

		fireEvent.mouseEnter(
			container.querySelector('.voicePlayer__toggle') as HTMLElement
		);

		expect(screen.getByRole('tooltip').textContent).toContain(
			'voicePlayer.encrypted'
		);
	});
});

describe('VoicePlayer bubble', () => {
	it.each([
		['incoming', 'voicePlayer--bubble-incoming'],
		['outgoing', 'voicePlayer--bubble-outgoing'],
		['none', 'voicePlayer--bubble-none']
	] as const)('applies the %s bubble class', (bubble, expected) => {
		const { container } = render(
			<VoicePlayer durationSec={12} bubble={bubble} />
		);

		expect(
			container
				.querySelector('.voicePlayer')
				?.classList.contains(expected)
		).toBe(true);
	});
});
