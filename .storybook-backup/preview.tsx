// Compound styles loaded via preview-head.html
import '../src/resources/styles/styles.scss';
import '../src/resources/styles/mui-variables-mapping.scss';
import i18n from 'i18next';
import { ThemeProvider } from '@mui/material';
import { Preview } from '@storybook/react';
import * as React from 'react';
import theme from '../src/resources/scripts/theme';
import { config } from '../src/resources/scripts/config';
import { LegalLinksProvider } from '../src/globalState/provider/LegalLinksProvider';
import { init, FALLBACK_LNG } from '../src/i18n';
import { BrowserRouter as Router } from 'react-router-dom';
import { Loading } from '../src/components/app/Loading';
import { Suspense } from 'react';
import {
	AppConfigContext,
	AppConfigProvider,
	RegistrationContext
} from '../src/globalState';

export const withMuiTheme = (Story) => (
	<Router>
		<Suspense fallback={<Loading />}>
			<AppConfigContext.Provider value={config}>
				<RegistrationContext.Provider
					value={{
						setDisabledNextButton: () => null,
						registrationData: {
							agency: null,
							agencyId: null,
							username: null,
							password: null,
							zipcode: null,
							mainTopic: {
								id: 1,
								name: 'Topic',
								slug: 'topic1',
								description: '',
								internalIdentifier: 'topic1',
								status: '',
								createDate: '',
								updateDate: ''
							},
							mainTopicId: 1
						}
					}}
				>
					<ThemeProvider theme={theme}>
						<LegalLinksProvider legalLinks={[]}>
							<Story />
						</LegalLinksProvider>
					</ThemeProvider>
				</RegistrationContext.Provider>
			</AppConfigContext.Provider>
		</Suspense>
	</Router>
);

export const decorators = [withMuiTheme];
init(config.i18n, null);

const preview: Preview = {
	parameters: {
		i18n,
		actions: { argTypesRegex: '^on[A-Z].*' },
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/
			}
		}
	},
	globals: {
		locale: FALLBACK_LNG,
		locales: {
			de: { icon: '🇩🇪', title: 'Deutsch', right: 'DE' },
			en: { icon: '🇺🇸', title: 'Englisch', right: 'EN' }
		}
	},
	tags: ['autodocs'],
	decorators: [withMuiTheme]
};

export default preview;
