import * as React from 'react';
import { Box, Dialog, IconButton, Link, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useTranslation } from 'react-i18next';

export interface LegalLinkDialogProps {
	open: boolean;
	title: string;
	/** The short platform-level note. Plain text — no HTML, no tenant content. */
	note: string;
	/** Where the full, legally binding text lives. */
	fullTextUrl: string;
	onClose: () => void;
}

/**
 * Imprint / data privacy on the login screen: a short note, not the full text.
 *
 * At login nobody has chosen a Beratungsstelle yet, so there is no carrier whose
 * legal text could be shown — anything carrier-specific here would be a guess.
 * What can be said at this point is platform level: who operates the platform,
 * and that the counselling itself is done by independent agencies whose own
 * texts follow once one is chosen. The full binding text stays one click away.
 *
 * MUI's `Dialog` already brings what the handoff asks for — Escape and scrim
 * click close it, focus is trapped and returned to the trigger — so only the
 * surface is specified here: 24 px radius, 620 px wide, scrim
 * `rgba(26,28,30,.45)`.
 */
export const LegalLinkDialog = ({
	open,
	title,
	note,
	fullTextUrl,
	onClose
}: LegalLinkDialogProps) => {
	const { t: translate } = useTranslation();

	return (
		<Dialog
			open={open}
			onClose={onClose}
			aria-label={title}
			maxWidth={false}
			slotProps={{
				backdrop: {
					sx: { backgroundColor: 'rgba(26, 28, 30, 0.45)' }
				}
			}}
			PaperProps={{
				sx: {
					width: '100%',
					maxWidth: '620px',
					m: 2,
					borderRadius: '24px',
					boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
					p: { xs: '24px 20px 20px', sm: '34px 40px 28px' }
				}
			}}
		>
			<Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
				<Typography
					component="h2"
					sx={{
						flex: 1,
						fontSize: { xs: 22, sm: 26 },
						fontWeight: 500,
						lineHeight: 1.2,
						color: 'var(--m3-on-surface, #1a1c1e)'
					}}
				>
					{title}
				</Typography>
				<IconButton
					onClick={onClose}
					aria-label={translate('app.close')}
					sx={{
						'width': 40,
						'height': 40,
						'flex': 'none',
						'backgroundColor':
							'var(--m3-surface-container, #f0edee)',
						'color': 'var(--m3-on-surface-variant, #444748)',
						'&:hover': {
							backgroundColor:
								'var(--m3-surface-container-high, #eae7e8)'
						}
					}}
				>
					<CloseRoundedIcon sx={{ fontSize: 18 }} />
				</IconButton>
			</Box>

			<Typography
				sx={{
					mt: 2,
					fontSize: 15,
					lineHeight: 1.6,
					whiteSpace: 'pre-line',
					color: 'var(--m3-on-surface-variant, #444748)'
				}}
			>
				{note}
			</Typography>

			<Link
				href={fullTextUrl}
				target="_blank"
				rel="noopener noreferrer"
				sx={{
					'display': 'inline-flex',
					'alignItems': 'center',
					'gap': '6px',
					'mt': 2.5,
					'fontSize': 15,
					'fontWeight': 600,
					'color': 'var(--m3-primary, #a5000a)',
					'&:focus-visible': {
						outline: '2px solid var(--m3-primary, #a5000a)',
						outlineOffset: '3px',
						borderRadius: '4px'
					}
				}}
			>
				{translate('login.legal.platform.fullText')}
				<OpenInNewRoundedIcon aria-hidden sx={{ fontSize: 16 }} />
			</Link>
		</Dialog>
	);
};
