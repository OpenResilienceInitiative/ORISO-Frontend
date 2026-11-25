import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import {
	PracticeCallStageView,
	type PracticeCallStageViewProps
} from '../../practice/PracticeCallStage';
import { PRACTICE_CALL_TARGETS } from '../../practice/practiceCallTargets';

/*
 * The practice call of the Gesprächskreis tour (FE#2545 D3, revised), as a
 * view with its state as arguments. In the app `PracticeCallLayer` feeds it
 * from the practice call store: the own preview from getUserMedia and Mia's
 * level from the generated murmur. Here a canvas stands in for the camera
 * and a sine for the level, so no permission prompt and no sound.
 */

const LINES = [
	'Hallo, ich bin Mia. Schön, dass Sie den Kreis eröffnet haben.',
	'Ich höre Sie gut. Probieren Sie ruhig die Knöpfe unten aus.',
	'Wenn Sie fertig sind, verlassen Sie einfach den Call. Bis bald!'
];

/** A moving gradient as the "camera": no device, no prompt. */
const useCanvasStream = (enabled: boolean): MediaStream | null => {
	const [stream, setStream] = React.useState<MediaStream | null>(null);
	React.useEffect(() => {
		if (!enabled) return undefined;
		const canvas = document.createElement('canvas');
		canvas.width = 320;
		canvas.height = 180;
		const context = canvas.getContext('2d');
		if (!context || typeof canvas.captureStream !== 'function') {
			return undefined;
		}
		let frame = 0;
		const draw = () => {
			const t = Date.now() / 1000;
			const gradient = context.createLinearGradient(0, 0, 320, 180);
			gradient.addColorStop(0, `hsl(${(t * 20) % 360} 40% 45%)`);
			gradient.addColorStop(1, `hsl(${(t * 20 + 120) % 360} 40% 30%)`);
			context.fillStyle = gradient;
			context.fillRect(0, 0, 320, 180);
			frame = requestAnimationFrame(draw);
		};
		draw();
		const captured = canvas.captureStream(15);
		setStream(captured);
		return () => {
			cancelAnimationFrame(frame);
			captured.getTracks().forEach((track) => track.stop());
		};
	}, [enabled]);
	return stream;
};

/** A speech-like level without audio: what the ring follows. */
const sineLevel = () => Math.max(0, Math.sin(Date.now() / 90) * 0.5 + 0.35);

type StoryArgs = Omit<PracticeCallStageViewProps, 'stream' | 'getLevel'>;

const Stage = (args: StoryArgs) => {
	const stream = useCanvasStream(args.media === 'granted' && !args.cameraOff);
	return (
		<div style={{ minHeight: '100vh' }}>
			<PracticeCallStageView
				{...args}
				stream={stream}
				getLevel={sineLevel}
			/>
		</div>
	);
};

const meta = {
	title: 'Organisms/PracticeCallStage',
	component: Stage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'The practice video call of the Gesprächskreis tour (FE#2545 D3, revised), in the look of the Element Call group stage (Call/Views → GroupStage). The own tile shows the local camera preview, or the initials when permission is refused or no device exists. Mia (Übung) is made up: her murmur is generated in the page with WebAudio, captions show what she says, and the ring follows the generated level. Mute, camera, minimise and leave carry tour anchors; minimised, the real `DockedCall` stands in. No call is placed and nothing leaves the page.'
			}
		}
	},
	args: {
		status: 'open',
		muted: false,
		cameraOff: false,
		media: 'granted',
		startedAt: Date.now() - 42_000,
		captionIndex: 0,
		self: {
			username: 'Frau Keller',
			userId: 'story-counsellor',
			firstName: 'Anna',
			lastName: 'Keller'
		},
		lines: LINES,
		onToggleMute: fn(),
		onToggleCamera: fn(),
		onMinimise: fn(),
		onExpand: fn(),
		onLeave: fn(),
		onShown: fn()
	}
} satisfies Meta<typeof Stage>;
export default meta;

type Story = StoryObj<typeof meta>;

const anchor = (name: string) =>
	document.querySelector<HTMLElement>(`[data-tour-target="${name}"]`);

/** Mia speaks: caption, speaking state, the ring follows the level. */
export const Speaking: Story = {
	play: async ({ args }) => {
		await waitFor(() =>
			expect(anchor(PRACTICE_CALL_TARGETS.stage)).not.toBeNull()
		);
		expect(
			screen.getByTestId('practice-call-caption').textContent
		).toContain(LINES[0]);
		const mia = screen.getByTestId('practice-call-mia-tile');
		expect(mia.dataset.speaking).toBe('true');
		await waitFor(() =>
			expect(
				Number(mia.style.getPropertyValue('--practice-call-level'))
			).toBeGreaterThan(0)
		);
		expect(args.onShown).toHaveBeenCalled();
		await userEvent.click(anchor(PRACTICE_CALL_TARGETS.leave)!);
		expect(args.onLeave).toHaveBeenCalledTimes(1);
	}
};

/** Muted: the control is pressed, the own tile shows the muted glyph. */
export const Muted: Story = {
	args: { muted: true, captionIndex: null },
	play: async ({ args }) => {
		const mute = await waitFor(() => {
			const control = anchor(PRACTICE_CALL_TARGETS.mute);
			expect(control).not.toBeNull();
			return control!;
		});
		expect(mute.getAttribute('aria-pressed')).toBe('true');
		expect(
			screen
				.getByTestId('practice-call-mia-tile')
				.hasAttribute('data-speaking')
		).toBe(false);
		await userEvent.click(mute);
		expect(args.onToggleMute).toHaveBeenCalledTimes(1);
	}
};

/** Camera off: the initials replace the preview. */
export const CameraOff: Story = {
	args: { cameraOff: true, captionIndex: 1 },
	play: async ({ args }) => {
		await waitFor(() =>
			expect(anchor(PRACTICE_CALL_TARGETS.camera)).not.toBeNull()
		);
		expect(screen.queryByTestId('practice-call-own-video')).toBeNull();
		expect(
			screen
				.getByTestId('practice-call-own-tile')
				.querySelector('[data-testid="user-avatar"]')
		).not.toBeNull();
		await userEvent.click(anchor(PRACTICE_CALL_TARGETS.camera)!);
		expect(args.onToggleCamera).toHaveBeenCalledTimes(1);
	}
};

/** Refused or no device: initials, a system notice, the controls still work. */
export const PermissionDenied: Story = {
	args: { media: 'denied' },
	play: async ({ args }) => {
		await waitFor(() =>
			expect(screen.getByTestId('practice-call-no-media')).toBeTruthy()
		);
		expect(screen.queryByTestId('practice-call-own-video')).toBeNull();
		await userEvent.click(anchor(PRACTICE_CALL_TARGETS.minimise)!);
		expect(args.onMinimise).toHaveBeenCalledTimes(1);
	}
};

/** Minimised: the app's real dock, with Mia, and its way back. */
export const MinimisedDock: Story = {
	args: { status: 'minimised' },
	play: async ({ args }) => {
		const dock = await waitFor(() => {
			const element = anchor(PRACTICE_CALL_TARGETS.dock);
			expect(element).not.toBeNull();
			return element!;
		});
		expect(dock.classList.contains('minimized-call-dock')).toBe(true);
		expect(anchor(PRACTICE_CALL_TARGETS.stage)).toBeNull();
		expect(dock.dataset.speaking).toBe('true');
		await userEvent.click(anchor(PRACTICE_CALL_TARGETS.expand)!);
		expect(args.onExpand).toHaveBeenCalledTimes(1);
	}
};
