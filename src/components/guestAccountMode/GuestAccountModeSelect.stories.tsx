import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { GuestAccountModeSelect } from './GuestAccountModeSelect';
import type { GuestAccountMode } from './guestAccountMode';
import { DirectLinkCard } from '../conversationCreate/directLink/DirectLinkCard';
import '../conversationCreate/conversationCreate.styles.scss';

/**
 * **Guest account select** (UserService#1662): which account a person
 * without one gets through an invitation link. Replaces the "Temporäres
 * Konto" switches on the direct link card, the direct link edit dialog and
 * the call share panel, and is new on the Gesprächskreis settings. Same
 * pattern as the topic row of the direct link card: `SplitButton` +
 * `RowMenu`. Only the modes platform and Träger allow are offered.
 */
const Controlled = (
	args: React.ComponentProps<typeof GuestAccountModeSelect>
) => {
	const [value, setValue] = useState<GuestAccountMode>(args.value);
	return (
		<div style={{ maxWidth: 360, padding: 24 }}>
			<GuestAccountModeSelect
				{...args}
				value={value}
				onChange={(next) => {
					setValue(next);
					args.onChange(next);
				}}
			/>
		</div>
	);
};

const meta: Meta<typeof GuestAccountModeSelect> = {
	title: 'Molecules/GuestAccountModeSelect',
	component: GuestAccountModeSelect,
	args: { value: 'PERMANENT', onChange: fn() },
	render: (args) => <Controlled {...args} />
};
export default meta;
type Story = StoryObj<typeof meta>;

const body = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

export const Permanent: Story = { name: 'Dauerhaft (chat default)' };

export const GuestChooses: Story = {
	name: 'Gast wählt (call default)',
	args: { value: 'GUEST_CHOOSES' }
};

export const Temporary: Story = {
	name: 'Nach der Sitzung löschen',
	args: { value: 'TEMPORARY' }
};

export const MenuOpen: Story = {
	name: 'Menu open · all three modes',
	play: async ({ args, canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole('button', { name: 'Dauerhaft' })
		);
		const menu = await body(canvasElement).findByRole('listbox', {
			name: 'Gastkonto'
		});
		await expect(
			within(menu)
				.getAllByRole('option')
				.map((option) => option.textContent)
		).toEqual(['Nach der Sitzung löschen', 'Gast wählt', 'Dauerhaft']);
		await userEvent.click(
			within(menu).getByRole('option', { name: 'Gast wählt' })
		);
		await expect(args.onChange).toHaveBeenCalledWith('GUEST_CHOOSES');
		await expect(
			within(canvasElement).getByText(/Neue Gäste wählen beim Beitreten/)
		).toBeVisible();
		// Open again for the screenshot.
		await userEvent.click(
			within(canvasElement).getByRole('button', { name: 'Gast wählt' })
		);
	}
};

export const MenuOpenRestricted: Story = {
	name: 'Menu open · Träger allows no temporary-only accounts',
	args: { allowed: ['GUEST_CHOOSES', 'PERMANENT'] },
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole('button', { name: 'Dauerhaft' })
		);
		const menu = await body(canvasElement).findByRole('listbox', {
			name: 'Gastkonto'
		});
		await expect(
			within(menu)
				.getAllByRole('option')
				.map((option) => option.textContent)
		).toEqual(['Gast wählt', 'Dauerhaft']);
	}
};

export const Compact: Story = {
	name: 'Compact (call share panel)',
	args: { value: 'GUEST_CHOOSES', size: 'compact' }
};

const TOPICS = [
	{ value: '4', label: 'Schulden' },
	{ value: '5', label: 'Sozialberatung' }
];

const CardStage = () => (
	<div className="conversationCreate">
		<div className="conversationCreate__single">
			<DirectLinkCard topics={TOPICS} onCreate={fn()} />
		</div>
	</div>
);

const chooseVideoAndOpen = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	await userEvent.click(canvas.getByRole('button', { name: 'Videoanruf' }));
	await expect(
		canvas.queryByRole('switch', { name: 'Temporäres Konto' })
	).not.toBeInTheDocument();
	await userEvent.click(canvas.getByRole('button', { name: 'Gast wählt' }));
	await body(canvasElement).findByRole('listbox', { name: 'Gastkonto' });
};

export const InDirectLinkCardDesktop: Story = {
	name: 'In the direct link card · video, menu open · 1440',
	globals: desktop1440Globals,
	parameters: { layout: 'fullscreen' },
	render: () => <CardStage />,
	play: async ({ canvasElement }) => chooseVideoAndOpen(canvasElement)
};

export const InDirectLinkCardMobile: Story = {
	name: 'In the direct link card · video, menu open · 390',
	globals: phone390Globals,
	parameters: { layout: 'fullscreen' },
	render: () => <CardStage />,
	play: async ({ canvasElement }) => chooseVideoAndOpen(canvasElement)
};
