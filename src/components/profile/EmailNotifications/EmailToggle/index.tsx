import React from 'react';
import { Switch } from '../../../Switch';
import { useEmailSettings } from '../emailSetting';

interface EmailToggleProps {
	name: string;
	titleKey: string;
	descriptionKey?: string;
	/** Shown while nothing is stored for `name` yet. */
	defaultChecked?: boolean;
}

export const EmailToggle = ({
	name,
	titleKey,
	descriptionKey,
	defaultChecked = false
}: EmailToggleProps) => {
	// Shared with the display filter's E-Mail column: one write path.
	const { read, change } = useEmailSettings();
	const source = { kind: 'path', name, fallback: defaultChecked } as const;

	return (
		<Switch
			titleKey={titleKey}
			descriptionKey={descriptionKey}
			onChange={(checked) => change(source, checked)}
			checked={read(source)}
		/>
	);
};
