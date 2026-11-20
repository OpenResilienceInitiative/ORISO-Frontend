import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { StandingAccessPreference } from './StandingAccessPreference';
import { CaseHandoverSystemMessageCard } from './CaseHandoverClientCards';
import {
	MessageStoryShell,
	phone390Globals
} from '../message/messageStoryShell';
import '../message/message.styles.scss';

/** Fixture readback only; production persistence is supplied by the host. */
const Fixture = ({ fail = false }: { fail?: boolean }) => {
	const { t } = useTranslation();
	const [saved, setSaved] = useState(false);
	return (
		<MessageStoryShell>
			<CaseHandoverSystemMessageCard
				title={t('caseHandover.consent.info.title')}
			>
				<StandingAccessPreference
					conversationId="fixture"
					alwaysAsk={saved}
					onSave={async (requested) => {
						if (fail) throw new Error('Fixture failure');
						setSaved(requested);
						return requested;
					}}
				/>
			</CaseHandoverSystemMessageCard>
		</MessageStoryShell>
	);
};
const meta = {
	title: 'Chat/System messages/Consent preference',
	component: StandingAccessPreference,
	args: { conversationId: 'fixture', alwaysAsk: false },
	parameters: { layout: 'fullscreen' },
	tags: ['autodocs']
} satisfies Meta<typeof StandingAccessPreference>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SavedPreference: Story = {
	render: () => <Fixture />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const control = canvas.getByRole('switch');
		await expect(control).not.toBeChecked();
		await userEvent.click(control);
		await waitFor(() => expect(control).toBeChecked());
		await waitFor(() => expect(canvas.getByRole('status')).toBeVisible());
		await userEvent.click(control);
		await expect(control).not.toBeChecked();
	}
};
export const Phone390: Story = { ...SavedPreference, globals: phone390Globals };
export const SaveFailure: Story = {
	render: () => <Fixture fail />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('switch'));
		await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible());
		await expect(canvas.getByRole('switch')).not.toBeChecked();
	}
};
