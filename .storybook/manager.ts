import { addons } from '@storybook/manager-api';
import { themes } from '@storybook/theming';

// Professional theme configuration
addons.setConfig({
	theme: themes.light,
	// Enable dark mode toggle
	enableShortcuts: true,
	showToolbar: true
});



