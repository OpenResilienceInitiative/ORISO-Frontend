import * as React from 'react';
import { Box, Typography } from '@mui/material';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import {
	registrationMd3,
	registrationScreenIntroSx,
	registrationScreenTitleSx
} from '../../registration/registrationDesign/registrationDesign';
import { callEntryCopy as copy } from './callEntryCopy';
import { CallEntryBlocker } from './callEntryTypes';

const ICONS: Record<CallEntryBlocker, React.ReactNode> = {
	permissionDenied: <MicOffRoundedIcon />,
	noDevice: <HeadsetMicOutlinedIcon />,
	deviceBusy: <MicOffRoundedIcon />,
	notOpenYet: <EventOutlinedIcon />,
	callEnded: <CallEndRoundedIcon />,
	linkInvalid: <LinkOffRoundedIcon />
};

/**
 * What stands in the column when the check cannot run. Each case says what
 * happened and what to do next; the action itself is the gate in the bar,
 * so the page keeps the one bar every waiting room has.
 */
export const CallNotice = ({ blocker }: { blocker: CallEntryBlocker }) => {
	const text = copy.blocker[blocker];
	return (
		<Box
			data-testid="call-notice"
			data-blocker={blocker}
			role="alert"
			sx={{
				maxWidth: 520,
				mx: 'auto',
				textAlign: 'center',
				pt: { xs: 2, lg: 8 }
			}}
		>
			<Box
				aria-hidden
				sx={{
					'mx': 'auto',
					'width': 72,
					'height': 72,
					'borderRadius': '50%',
					'bgcolor': registrationMd3.surfaceContainer,
					'color': registrationMd3.primary,
					'display': 'flex',
					'alignItems': 'center',
					'justifyContent': 'center',
					'& svg': { fontSize: 34 }
				}}
			>
				{ICONS[blocker]}
			</Box>
			<Typography
				component="h1"
				sx={{ ...registrationScreenTitleSx, mt: 3 }}
			>
				{text.title}
			</Typography>
			<Typography sx={{ ...registrationScreenIntroSx, mt: 1.5 }}>
				{text.body}
			</Typography>
			{text.steps.length > 0 && (
				<Box
					component="ol"
					sx={{
						'textAlign': 'left',
						'mt': 3,
						'mx': 'auto',
						'maxWidth': 420,
						'pl': 3,
						'color': registrationMd3.onSurface,
						'fontSize': 15,
						'lineHeight': '24px',
						'& li + li': { mt: 1 }
					}}
				>
					{text.steps.map((step) => (
						<li key={step}>{step}</li>
					))}
				</Box>
			)}
		</Box>
	);
};
