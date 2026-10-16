import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { RegistrationFooter } from '../registrationFooter/RegistrationFooter';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';

export interface WaitingRoomTemplateProps {
	/** Above the headline, e.g. the registration's "Registriert" chip. */
	eyebrow?: React.ReactNode;
	headline: string;
	/** What is happening right now; announced to screen readers. */
	status: React.ReactNode;
	/** Before the status, e.g. the live chat's queue dots. */
	statusLeading?: React.ReactNode;
	/** Bold and in the primary colour: something changed for the person. */
	statusEmphasis?: boolean;
	/**
	 * The middle: the card carousel, or another waiting component such as the
	 * self-help group's countdown clock.
	 */
	children: React.ReactNode;
	/**
	 * `false` renders the middle as it is, without the column that lets the
	 * cards bleed to the phone's edges (the breathing companion brings its own).
	 */
	contentBox?: boolean;
	/** Quiet row under the middle: companion, a written alternative. */
	aside?: React.ReactNode;
	/** The bar's content: the gate button. */
	gate: React.ReactNode;
	/**
	 * The consent that slides in with the bar (`WaitingRoomConsentPanel`).
	 * The bar is mounted anew when it appears, so the slide plays.
	 */
	consent?: React.ReactNode;
}

/**
 * The one layout of every waiting room, taken from the live-chat room
 * (Frank, 2026-10-16: "Das ist der Pixel Perfect … Master-Template"):
 * headline, status line, the middle, a quiet row under it, and the shared bar
 * with the gate, into which the consent slides once it is the person's turn.
 *
 * It sits inside `WaitingRoomFrame` (usually via `EntryRoomShell`). What
 * stands in the middle is the room's own business: cards or a clock.
 */
export const WaitingRoomTemplate = ({
	eyebrow,
	headline,
	status,
	statusLeading,
	statusEmphasis = false,
	children,
	contentBox = true,
	aside,
	gate,
	consent
}: WaitingRoomTemplateProps) => (
	<>
		<Box data-cy="waiting-room-template" sx={{ mb: 3 }}>
			{eyebrow}
			<Typography
				component="h1"
				sx={{
					fontSize: { xs: 30, sm: 34 },
					lineHeight: { xs: '36px', sm: '41px' },
					fontWeight: 700,
					color: registrationMd3.onSurface
				}}
			>
				{headline}
			</Typography>
			<Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
				{statusLeading}
				<Typography
					role="status"
					aria-live="polite"
					sx={{
						fontSize: 16,
						fontWeight: statusEmphasis ? 700 : 400,
						color: statusEmphasis
							? registrationMd3.primary
							: registrationMd3.onSurfaceVariant
					}}
				>
					{status}
				</Typography>
			</Box>
		</Box>

		{contentBox ? (
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					display: 'flex',
					flexDirection: 'column',
					mx: { xs: -2.5, sm: 0 }
				}}
			>
				{children}
			</Box>
		) : (
			children
		)}

		{aside && (
			<Box
				sx={{
					mt: 1.5,
					mb: -1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 2,
					flexWrap: 'wrap'
				}}
			>
				{aside}
			</Box>
		)}

		{consent ? (
			<RegistrationFooter key="consent" animateIn consent={consent}>
				{gate}
			</RegistrationFooter>
		) : (
			<RegistrationFooter key="gate">{gate}</RegistrationFooter>
		)}
	</>
);
