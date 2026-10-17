import * as React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';

export interface DeviceToggleProps {
	on: boolean;
	onToggle: () => void;
	iconOn: React.ReactNode;
	iconOff: React.ReactNode;
	/**
	 * The stable accessible name, e.g. "Mikrofon"; `aria-pressed` says
	 * whether the device is on.
	 */
	name: string;
	/** The tooltip: what a press does, e.g. "Mikrofon aus". */
	labelOn: string;
	labelOff: string;
	/** On the dark video tile, or on the white column (voice check). */
	tone: 'onDark' | 'onSurface';
	size?: number;
	testId?: string;
}

/**
 * Round mic/camera switch. "Off" is not only a colour: the icon changes to
 * its crossed-out form and the button fills, so the state reads without
 * colour (AGENTS.md, frontend rules).
 */
export const DeviceToggle = ({
	on,
	onToggle,
	iconOn,
	iconOff,
	name,
	labelOn,
	labelOff,
	tone,
	size = 48,
	testId
}: DeviceToggleProps) => {
	const label = on ? labelOn : labelOff;
	const idle =
		tone === 'onDark'
			? {
					bgcolor: 'rgba(255,255,255,.16)',
					color: '#fff',
					border: '1px solid rgba(255,255,255,.4)'
				}
			: {
					bgcolor: registrationMd3.surfaceContainerLowest,
					color: registrationMd3.onSurface,
					border: `1px solid ${registrationMd3.outline}`
				};
	return (
		<Tooltip title={label} describeChild>
			<IconButton
				aria-label={name}
				aria-pressed={on}
				onClick={onToggle}
				data-testid={testId}
				sx={{
					'width': size,
					'height': size,
					...(on
						? idle
						: {
								bgcolor: registrationMd3.primary,
								color: registrationMd3.onPrimary,
								border: `1px solid ${registrationMd3.primary}`
							}),
					'&:hover': {
						bgcolor: on
							? tone === 'onDark'
								? 'rgba(255,255,255,.26)'
								: registrationMd3.surfaceContainer
							: registrationMd3.primaryDark
					},
					'&:focus-visible': {
						outline: `3px solid ${
							tone === 'onDark' ? '#fff' : registrationMd3.primary
						}`,
						outlineOffset: 2
					}
				}}
			>
				{on ? iconOn : iconOff}
			</IconButton>
		</Tooltip>
	);
};
