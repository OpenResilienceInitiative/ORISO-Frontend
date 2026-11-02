import * as React from 'react';
import { useContext } from 'react';
import { AppConfigContext } from '../../../globalState';
import type { ChatComposerFormat } from '../../message/chatMessageConfig';

/**
 * What GET /service/settings hands the app, for one story: the disabled formats
 * as the comma-separated string the server stores. Keeps the rest of the preview
 * config.
 */
export const PlatformFormatsProvider = ({
	disabledFormats,
	children
}: {
	disabledFormats: readonly ChatComposerFormat[];
	children: React.ReactNode;
}) => {
	const config = useContext(AppConfigContext);
	return (
		<AppConfigContext.Provider
			value={{
				...config,
				chatComposerDisabledFormats: disabledFormats.join(',')
			}}
		>
			{children}
		</AppConfigContext.Provider>
	);
};
