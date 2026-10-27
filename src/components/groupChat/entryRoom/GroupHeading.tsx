import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';

type Align = 'left' | 'center';

/**
 * Which group this is: the topic as an eyebrow, the agency below it. Two
 * lines, never one joined sentence — both come from the API (Frank,
 * 2026-09-07). Shared by the waiting room and the invitation's account step,
 * so the person sees the same name before and after "Der Gruppe beitreten"
 * (#1689). The leading is tight on purpose: 11 and 14 px at the inherited
 * 24 px spent 48 px on two short lines.
 */
export const GroupHeading = ({
	topicName,
	agencyName,
	textAlign
}: {
	topicName?: string;
	agencyName?: string;
	textAlign: Align | { xs: Align; lg: Align };
}) => {
	if (!topicName && !agencyName) return null;
	return (
		<Box data-cy="group-heading" sx={{ textAlign }}>
			{topicName && (
				<Typography
					sx={{
						fontSize: 11,
						lineHeight: 1.35,
						fontWeight: 600,
						letterSpacing: '.12em',
						textTransform: 'uppercase',
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{topicName}
				</Typography>
			)}
			{agencyName && (
				<Typography
					sx={{
						fontSize: 14,
						lineHeight: 1.35,
						fontWeight: 600,
						color: registrationMd3.onSurface
					}}
				>
					{agencyName}
				</Typography>
			)}
		</Box>
	);
};
