import * as React from 'react';
import { ThemeProvider } from '@mui/material';
import type { Preview } from '@storybook/react-vite';
import theme from '../src/resources/scripts/theme';

// PROOF preview (minimal). Full app-context shell kept as preview.tsx.sb7.bak
// and restored during hardening.

const preview: Preview = {
	parameters: {
		backgrounds: {
			default: 'light',
			values: [{ name: 'light', value: '#ffffff' }]
		}
	},
	decorators: [
		(Story) => (
			<ThemeProvider theme={theme}>
				<Story />
			</ThemeProvider>
		)
	]
};
export default preview;
