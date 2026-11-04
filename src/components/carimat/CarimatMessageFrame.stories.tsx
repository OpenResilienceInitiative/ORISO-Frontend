import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { CaseHandoverConsentCard } from '../caseHandover/CaseHandoverClientCards';
import { MessageItemComponent } from '../message/MessageItemComponent';
import {
	ActiveSessionContext,
	AUTHORITIES,
	E2EEContext,
	UserDataContext
} from '../../globalState';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import {
	mockActiveSession1on1,
	mockE2EEContext,
	mockUserData,
	mockServerSettingsContext,
	mockMessageItemComponentProps
} from '../message/MessageItemComponent.mocks';
import { PseudonymCard } from '../pseudonym/PseudonymCard';
import { PrivacyMessageCard } from '../pseudonym/PrivacyMessageCard';
import { ErstantwortSequence } from '../erstantwort/ErstantwortSequence';
import {
	PSEUDONYM_TYPICAL,
	phone390Globals
} from '../message/messageStoryShell';

const meta: Meta = {
	title: 'Chat/System messages/Shared assistant presentation',
	globals: { locale: 'en' },
	parameters: { layout: 'fullscreen' }
};
export default meta;
type Story = StoryObj<typeof meta>;
const PersistedGrant = () => (
	<ServerSettingsContext.Provider value={mockServerSettingsContext()}>
		<E2EEContext.Provider value={mockE2EEContext()}>
			<UserDataContext.Provider
				value={{
					userData: mockUserData({
						grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
					}),
					setUserData: () => {},
					reloadUserData: async () => null
				}}
			>
				<ActiveSessionContext.Provider
					value={{
						activeSession: mockActiveSession1on1(),
						reloadActiveSession: () => {},
						readActiveSession: () => {}
					}}
				>
					<MessageItemComponent
						{...mockMessageItemComponentProps({
							isMyMessage: false,
							userId: 'system',
							username: 'system',
							displayName: 'system',
							message:
								'[SYSTEM_NOTIFICATION]' +
								JSON.stringify({
									type: 'CASE_HANDOVER_GRANTED',
									description:
										'Recorded temporary access for this enquiry.',
									handover: {
										requestId: 123,
										clientConsent: 'NONE',
										accessType: 'CO_ACCESS'
									}
								})
						})}
					/>
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		</E2EEContext.Provider>
	</ServerSettingsContext.Provider>
);
const Families = () => (
	<div style={{ padding: 24 }}>
		<section aria-label="Displayed name message">
			<PseudonymCard
				pseudonym={{
					displayName: PSEUDONYM_TYPICAL,
					animalLabel: 'Alpaka',
					name: 'Mika',
					avatar: {
						file: 'alpaca.svg',
						bg: '#E8DEF8',
						iconColor: '#1D1B20'
					}
				}}
				skipTyping
			/>
		</section>
		<section aria-label="Privacy message">
			<PrivacyMessageCard skipTyping />
		</section>
		<section aria-label="First response message">
			<ErstantwortSequence
				skipAnimation
				bausteine={[
					{
						id: 'greeting',
						body: 'Your enquiry has arrived. We will answer here.'
					}
				]}
			/>
		</section>
		<section aria-label="Pending consent message">
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</section>
		<section aria-label="Recorded access message">
			<PersistedGrant />
		</section>
	</div>
);
const checkSharedPresentation: Story['play'] = async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	const regions = [
		'Displayed name message',
		'Privacy message',
		'First response message',
		'Pending consent message',
		'Recorded access message'
	].map((name) => canvas.getByRole('region', { name }));
	await waitFor(() =>
		regions.forEach((region) =>
			expect(within(region).getByText('Carimat')).toBeVisible()
		)
	);
	await waitFor(() => {
		const rects = regions.map((region) => {
			const bubble = region.querySelector<HTMLElement>(
				'.carimatMessageFrame__bubble'
			)!;
			const avatar = region.querySelector<HTMLElement>(
				'.carimatMessageFrame__avatar'
			)!;
			const header = within(region).getByText('Carimat');
			return {
				bubble: bubble.getBoundingClientRect(),
				avatar: avatar.getBoundingClientRect(),
				header: header.getBoundingClientRect()
			};
		});
		for (const row of rects.slice(1)) {
			expect(
				Math.abs(row.bubble.left - rects[0].bubble.left)
			).toBeLessThanOrEqual(1);
			expect(
				Math.abs(row.bubble.width - rects[0].bubble.width)
			).toBeLessThanOrEqual(1);
			expect(
				Math.abs(row.avatar.width - rects[0].avatar.width)
			).toBeLessThanOrEqual(1);
			expect(
				Math.abs(row.header.left - rects[0].header.left)
			).toBeLessThanOrEqual(1);
		}
		for (const row of rects)
			expect(row.header.left).toBeGreaterThanOrEqual(row.avatar.right);
	});
	expect(
		canvas.getByText('Your enquiry has arrived. We will answer here.')
	).toBeVisible();
	expect(canvas.queryByRole('dialog')).toBeNull();
};
export const ExistingMessageFamilies: Story = {
	render: Families,
	play: checkSharedPresentation
};
export const ExistingMessageFamiliesPhone: Story = {
	...ExistingMessageFamilies,
	globals: { ...phone390Globals, locale: 'en' }
};

export const ExistingMessageFamiliesGerman: Story = {
	...ExistingMessageFamilies,
	globals: { locale: 'de' }
};
export const ExistingMessageFamiliesFrench: Story = {
	...ExistingMessageFamilies,
	globals: { locale: 'fr' }
};
