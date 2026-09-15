import * as React from 'react';
import { useContext } from 'react';
import { Box, Typography } from '@mui/material';
import { StageLayout } from '../../stageLayout/StageLayout';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';

export interface EntryRoomShellProps {
	/** Line 1 of the heading — what this link is (already translated). */
	kicker: string;
	/** Line 2 — what is happening right now, or who has taken the conversation. */
	statusLine: string;
	showLoginLink?: boolean;
	children: React.ReactNode;
}

/**
 * The entry room's frame: the stage on the left, one white column on the
 * right, the heading in the stage header on a desktop and at the top of the
 * column on a phone. Every way into a conversation — live chat, self-help
 * group, appointment — passes through this frame (Frank, 2026-09-05: "unser
 * Entry Room, den wir ja so eigentlich als Standardmodul haben").
 *
 * Height: the column is the viewport minus the stage header (96 / 64) and
 * the stage's 32 px below, so content can centre itself; `pb` keeps the
 * fixed `RegistrationFooter` bar clear.
 */
export const EntryRoomShell = ({
	kicker,
	statusLine,
	showLoginLink = false,
	children
}: EntryRoomShellProps) => {
	const { Stage } = useContext(GlobalComponentContext);
	const heading = (
		<Box sx={{ textAlign: { xs: 'center', lg: 'left' } }}>
			<Typography
				sx={{
					fontSize: 11,
					fontWeight: 600,
					letterSpacing: '.12em',
					textTransform: 'uppercase',
					color: registrationMd3.onSurfaceVariant
				}}
			>
				{kicker}
			</Typography>
			{/* The line changes while the person waits — "eine Beraterin hat
			    angenommen", "gerade geschlossen". Without a live region a
			    screen reader never learns about it. */}
			<Typography
				role="status"
				aria-live="polite"
				sx={{
					fontSize: 14,
					fontWeight: 600,
					color: registrationMd3.onSurface
				}}
			>
				{statusLine}
			</Typography>
		</Box>
	);
	return (
		<StageLayout
			className="stageLayout--registration"
			showLegalLinks={true}
			showLoginLink={showLoginLink}
			showRegistrationLink={false}
			stage={<Stage hasAnimation={false} isReady={true} />}
			mobileHero="bar"
			headerStart={heading}
		>
			<Box
				data-cy="entry-room"
				sx={{
					width: '100%',
					minWidth: 0,
					minHeight: {
						xs: 'calc(100vh - 96px)',
						lg: 'calc(100vh - 128px)'
					},
					display: 'flex',
					flexDirection: 'column',
					px: { xs: 2.5, sm: 5 },
					pt: { xs: 3, sm: 4 },
					pb: '104px'
				}}
			>
				<Box sx={{ display: { xs: 'block', lg: 'none' }, mb: 3 }}>
					{heading}
				</Box>
				{children}
			</Box>
		</StageLayout>
	);
};
