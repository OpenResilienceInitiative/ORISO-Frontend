import * as React from 'react';
import type { Decorator } from '@storybook/react-vite';
import { addons, useEffect, useRef } from 'storybook/preview-api';
import { FORCE_REMOUNT } from 'storybook/internal/core-events';

/** A globals rerender does not rerun play; restart only opted-in form demos. */
export const WithEntryFormDemo: Decorator = (Story, context) => {
	const mode = context.globals.entryFormDemo;
	const previous = useRef({ id: context.id, mode });
	useEffect(() => {
		const changed =
			previous.current.id === context.id &&
			previous.current.mode !== mode;
		previous.current = { id: context.id, mode };
		if (
			changed &&
			context.viewMode === 'story' &&
			context.parameters.entryFormDemo &&
			context.playFunction
		) {
			addons.getChannel().emit(FORCE_REMOUNT, { storyId: context.id });
		}
	}, [
		context.id,
		context.viewMode,
		context.parameters.entryFormDemo,
		context.playFunction,
		mode
	]);
	return <Story />;
};
