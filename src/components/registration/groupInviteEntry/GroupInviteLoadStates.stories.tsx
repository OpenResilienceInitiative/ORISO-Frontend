import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
	GroupInviteLoadError,
	GroupInviteLoading
} from './GroupInviteLoadError';
import { Stage } from '../../stage/stage';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';

/**
 * #1499 — what a newcomer sees on the invite link before the entry (0a) is
 * ready: a loading indicator while the group's topic loads, and a retry when
 * it fails. Before, both were a blank page.
 */
const meta = {
	title: 'Group chat/Self-help entry room — load states',
	component: GroupInviteLoading,
	parameters: { layout: 'fullscreen' },
	args: { stage: <Stage />, gcid: '15', aid: '88' }
} satisfies Meta<typeof GroupInviteLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

const expectLoading = async (canvasElement: HTMLElement) => {
	await expect(
		page(canvasElement).getByRole('status', {
			name: 'Die Einladung wird geladen …'
		})
	).toBeVisible();
	await expect(page(canvasElement).queryByRole('alert')).toBeNull();
};

export const Loading1440: Story = {
	name: 'Loading · 1440',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => expectLoading(canvasElement)
};

export const Loading390: Story = {
	name: 'Loading · 390',
	globals: phone390Globals,
	play: async ({ canvasElement }) => expectLoading(canvasElement)
};

const onRetry = fn();

const LoadErrorStory = (
	args: React.ComponentProps<typeof GroupInviteLoading>
) => <GroupInviteLoadError {...args} onRetry={onRetry} />;

const expectRetry = async (canvasElement: HTMLElement) => {
	onRetry.mockClear();
	await expect(page(canvasElement).getByRole('alert')).toHaveTextContent(
		'Die Einladung konnte gerade nicht geladen werden.'
	);
	await userEvent.click(
		page(canvasElement).getByRole('button', { name: 'Erneut versuchen' })
	);
	await expect(onRetry).toHaveBeenCalledTimes(1);
};

export const LoadError1440: Story = {
	name: 'Load failed · retry · 1440',
	globals: desktop1440Globals,
	render: LoadErrorStory,
	play: async ({ canvasElement }) => expectRetry(canvasElement)
};

export const LoadError390: Story = {
	name: 'Load failed · retry · 390',
	globals: phone390Globals,
	render: LoadErrorStory,
	play: async ({ canvasElement }) => expectRetry(canvasElement)
};
