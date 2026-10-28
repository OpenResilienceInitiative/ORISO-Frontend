import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import type { TenantDataInterface } from '../../globalState/interfaces/TenantDataInterface';
import { ErstantwortSequence } from '../erstantwort/ErstantwortSequence';

const AssistantMessage = ({
	name = 'Help companion',
	icon = 'robot-1184077'
}: {
	name?: string;
	icon?: string;
}) => {
	const tenant: TenantDataInterface = {
		id: 1,
		name: 'Example organisation',
		theming: {
			assistantName: name,
			assistantIcon: icon,
			logo: '',
			associationLogo: null,
			favicon: '',
			primaryColor: '#a5000a',
			secondaryColor: '#fff'
		},
		content: {
			impressum: '',
			privacy: '',
			termsAndConditions: '',
			claim: '',
			dataPrivacyConfirmation: '',
			termsAndConditionsConfirmation: ''
		}
	};
	return (
		<TenantContext.Provider
			value={{
				tenant,
				setTenant: () => undefined,
				updateTenantSettings: () => undefined
			}}
		>
			<ErstantwortSequence
				skipAnimation
				bausteine={[
					{ id: 'greeting', body: 'Your message has arrived.' }
				]}
			/>
		</TenantContext.Provider>
	);
};
const meta = {
	title: 'System messages/Assistant identity',
	component: AssistantMessage,
	parameters: { layout: 'padded' }
} satisfies Meta<typeof AssistantMessage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SavedIdentity: Story = {};
export const DefaultIdentity: Story = { args: { name: '', icon: 'default' } };
