import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Registration } from './Registration';
import { AgencySpecificContext, RegistrationProvider } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { registrationSessionStorageKey } from '../../globalState/provider/RegistrationProvider';
import { Stage } from '../stage/stage';

const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';
const APP_ORISO_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725&t=XHH5HQNmA8DUWl2U-0';

function RegistrationRuntimeStory() {
	const [sessionCleared, setSessionCleared] = useState(false);
	const [specificAgency, setSpecificAgency] = useState<any>(null);

	useEffect(() => {
		sessionStorage.removeItem(registrationSessionStorageKey);
		setSessionCleared(true);
	}, []);

	if (!sessionCleared) {
		return null;
	}

	return (
		<AgencySpecificContext.Provider
			value={{
				specificAgency,
				setSpecificAgency
			}}
		>
			<GlobalComponentContext.Provider value={{ Stage }}>
				<RegistrationProvider>
					<Routes>
						<Route
							path="/registration"
							element={<Registration />}
						/>
						<Route
							path="/registration/:step"
							element={<Registration />}
						/>
						<Route
							path="/:topicSlug/registration"
							element={<Registration />}
						/>
						<Route
							path="/:topicSlug/registration/:step"
							element={<Registration />}
						/>
						<Route
							path="*"
							element={
								<Navigate
									to="/registration/topic-selection"
									replace
								/>
							}
						/>
					</Routes>
				</RegistrationProvider>
			</GlobalComponentContext.Provider>
		</AgencySpecificContext.Provider>
	);
}

const meta = {
	title: 'REGISTRATION/Registration runtime',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'light' },
		router: {
			initialPath: '/registration/topic-selection'
		},
		design: [
			{
				type: 'figma',
				name: 'App.Oriso',
				url: APP_ORISO_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Runtime story for the real routed `Registration` component. It uses the app `RegistrationProvider`, Storybook API fixtures from preview.tsx, real `StageLayout`, and a MemoryRouter route so `useParams()` receives the active registration step.'
			}
		}
	}
} satisfies Meta<typeof RegistrationRuntimeStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TopicSelectionRoute: Story = {
	render: () => <RegistrationRuntimeStory />
};
