import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { LoginHandoverScreen } from './LoginHandoverScreen';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';

const meta = {
	title: 'FEEDBACK/LoginHandoverScreen',
	component: LoginHandoverScreen,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'One calm screen between "Login" and the app. It fades in over the login page once the credentials are accepted, stays across the document load to the app (app.html paints the same background before any script runs) and fades out when the app is ready. It replaces the red → white → red flicker of the old sign-in.'
			}
		}
	}
} satisfies Meta<typeof LoginHandoverScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const LoginPageBehind = ({ children }: { children: React.ReactNode }) => (
	<div style={{ height: '100dvh' }}>
		<StageLayout stage={<Stage hasAnimation={false} isReady />}>
			<div style={{ padding: 24 }}>Login form</div>
		</StageLayout>
		{children}
	</div>
);

const assertCoversViewport = async (canvasElement: HTMLElement) => {
	const screen = canvasElement.querySelector<HTMLElement>(
		'.loginHandoverScreen'
	);
	expect(screen).not.toBeNull();
	if (!screen) return;
	const rect = screen.getBoundingClientRect();
	expect(rect.width).toBeGreaterThanOrEqual(window.innerWidth - 1);
	expect(rect.height).toBeGreaterThanOrEqual(window.innerHeight - 1);
	// Opaque: nothing of the red login stage may show through.
	await waitFor(() => expect(getComputedStyle(screen).opacity).toBe('1'));
	expect(getComputedStyle(screen).backgroundColor).not.toBe(
		'rgba(0, 0, 0, 0)'
	);
	expect(within(canvasElement).getByRole('status')).toBeVisible();
};

/** On the login page, right after "Login" with accepted credentials. */
export const OverLoginPage: Story = {
	name: 'Over the login page (fades in)',
	args: { animateIn: true },
	render: (args) => (
		<LoginPageBehind>
			<LoginHandoverScreen {...args} />
		</LoginPageBehind>
	),
	play: async ({ canvasElement }) => {
		await assertCoversViewport(canvasElement);
	}
};

/** On the new document after the load to /app: already there, no fade. */
export const ContinuedAfterReload: Story = {
	name: 'Continued on the app document',
	args: { animateIn: false },
	play: async ({ canvasElement }) => {
		await assertCoversViewport(canvasElement);
	}
};

export const Mobile: Story = {
	...OverLoginPage,
	name: 'Over the login page — mobile',
	globals: { viewport: { value: 'phone375' } }
};

/** Faded in on this page, then the app is ready: it must still fade out. */
export const FadedInThenLeaving: Story = {
	name: 'Faded in, then leaving (same page)',
	render: function FadedInThenLeavingStory() {
		const [leaving, setLeaving] = useState(false);
		useEffect(() => {
			const timeout = window.setTimeout(() => setLeaving(true), 600);
			return () => window.clearTimeout(timeout);
		}, []);
		return (
			<div style={{ height: '100dvh', padding: 24 }}>
				<p>The app is ready underneath.</p>
				<LoginHandoverScreen animateIn leaving={leaving} />
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const screen = canvasElement.querySelector<HTMLElement>(
			'.loginHandoverScreen'
		);
		expect(screen).not.toBeNull();
		if (!screen) return;
		await waitFor(
			() => expect(Number(getComputedStyle(screen).opacity)).toBe(0),
			{ timeout: 3000 }
		);
	}
};

/** The app is ready: the screen fades out and reveals it. */
export const LeavingToApp: Story = {
	name: 'Leaving to the app (fades out)',
	render: function Leaving() {
		const [leaving, setLeaving] = useState(false);
		useEffect(() => {
			const timeout = window.setTimeout(() => setLeaving(true), 600);
			return () => window.clearTimeout(timeout);
		}, []);
		return (
			<div style={{ height: '100dvh', padding: 24 }}>
				<p>The app is ready underneath.</p>
				<LoginHandoverScreen leaving={leaving} />
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const screen = canvasElement.querySelector<HTMLElement>(
			'.loginHandoverScreen'
		);
		await waitFor(
			() =>
				expect(
					screen?.classList.contains('loginHandoverScreen--leaving')
				).toBe(true),
			{ timeout: 2000 }
		);
	}
};
