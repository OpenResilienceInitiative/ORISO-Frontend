import * as React from 'react';
import { useId, useState } from 'react';
import { ButtonBase, Menu, MenuItem, Typography, Box } from '@mui/material';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { CallDevice, CallDeviceKind } from './callEntryTypes';

const ICONS: Record<CallDeviceKind, React.ReactNode> = {
	camera: <VideocamRoundedIcon />,
	microphone: <MicRoundedIcon />,
	speaker: <VolumeUpRoundedIcon />
};

export interface DevicePickerProps {
	kind: CallDeviceKind;
	/** Already translated, e.g. "Mikrofon". */
	kindLabel: string;
	devices: CallDevice[];
	selectedId?: string;
	onSelect: (id: string) => void;
}

/**
 * One pill per device kind: the icon says what it is, the text which device
 * is in use, one tap opens the list (Frank, 2026-10-15: "kurz ein Icon
 * aufwählt", Teams as reference). A single device needs no choice, so the
 * pill then only names it.
 */
export const DevicePicker = ({
	kind,
	kindLabel,
	devices,
	selectedId,
	onSelect
}: DevicePickerProps) => {
	const menuId = useId();
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const selected =
		devices.find((device) => device.id === selectedId) ?? devices[0];
	const choosable = devices.length > 1;
	return (
		<>
			<ButtonBase
				aria-label={`${kindLabel}: ${selected?.label ?? '–'}`}
				aria-haspopup={choosable ? 'menu' : undefined}
				aria-controls={anchor ? menuId : undefined}
				aria-expanded={anchor ? true : undefined}
				disabled={!choosable}
				onClick={(event) => setAnchor(event.currentTarget)}
				data-testid={`device-picker-${kind}`}
				sx={{
					'minWidth': 0,
					'flex': '1 1 0',
					'height': 44,
					'px': 1.5,
					'gap': 1,
					'justifyContent': 'flex-start',
					'borderRadius': '22px',
					'border': `1px solid ${registrationMd3.outline}`,
					'color': registrationMd3.onSurface,
					'&.Mui-disabled': { color: registrationMd3.onSurface },
					'&:focus-visible': {
						outline: `3px solid ${registrationMd3.focusLayer}`,
						outlineOffset: 2
					},
					'& > svg:first-of-type': {
						fontSize: 20,
						color: registrationMd3.primary,
						flexShrink: 0
					}
				}}
			>
				{ICONS[kind]}
				<Typography
					component="span"
					sx={{
						fontSize: 14,
						minWidth: 0,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap'
					}}
				>
					{selected?.label ?? '–'}
				</Typography>
				{choosable && (
					<Box
						component="span"
						sx={{ ml: 'auto', display: 'flex', flexShrink: 0 }}
					>
						<ExpandMoreRoundedIcon sx={{ fontSize: 20 }} />
					</Box>
				)}
			</ButtonBase>
			<Menu
				id={menuId}
				anchorEl={anchor}
				open={Boolean(anchor)}
				onClose={() => setAnchor(null)}
			>
				{devices.map((device) => (
					<MenuItem
						key={device.id}
						selected={device.id === selected?.id}
						onClick={() => {
							onSelect(device.id);
							setAnchor(null);
						}}
						sx={{ gap: 1, fontSize: 14 }}
					>
						<Box
							component="span"
							sx={{ width: 20, display: 'flex' }}
						>
							{device.id === selected?.id && (
								<CheckRoundedIcon sx={{ fontSize: 18 }} />
							)}
						</Box>
						{device.label}
					</MenuItem>
				))}
			</Menu>
		</>
	);
};
