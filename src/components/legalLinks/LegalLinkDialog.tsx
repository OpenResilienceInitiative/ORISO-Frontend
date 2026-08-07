import * as React from 'react';
import { Box, Dialog, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from 'react-i18next';
import { LegalContentRenderer } from '../legalContent/LegalContentRenderer';

export interface LegalLinkDialogProps {
	open: boolean;
	title: string;
	/** Raw legal content: language map or plain HTML. */
	content: string | null | undefined;
	onClose: () => void;
}

/**
 * Imprint / data privacy in a modal instead of a new tab.
 *
 * The login screen is the first thing a person in trouble sees; sending them
 * to a second tab to read the privacy policy loses the login. MUI's `Dialog`
 * already brings what the handoff asks for — Escape and scrim click close it,
 * focus is trapped and returned to the trigger — so only the surface itself is
 * specified here: 24 px radius, 620 px wide, scrim `rgba(26,28,30,.45)`.
 */
export const LegalLinkDialog = ({
	open,
	title,
	content,
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
					maxHeight: '600px',
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
			<Box
				sx={{
					'mt': 2,
					'overflowY': 'auto',
					'fontSize': 15,
					'lineHeight': 1.6,
					'color': 'var(--m3-on-surface-variant, #444748)',
					// `LegalContentRenderer` is sized for a full page, where its
					// h2 is the largest thing on screen. In a 620 px dialog that
					// makes the section headings shout over the dialog's own
					// title, so the scale is stepped down here.
					'& h1, & h2': {
						fontSize: 19,
						fontWeight: 600,
						lineHeight: 1.3,
						mt: 3,
						mb: 1,
						color: 'var(--m3-on-surface, #1a1c1e)'
					},
					'& h3, & h4': {
						fontSize: 16,
						fontWeight: 600,
						lineHeight: 1.35,
						mt: 2.5,
						mb: 0.75,
						color: 'var(--m3-on-surface, #1a1c1e)'
					},
					'& > *:first-of-type': { mt: 0 }
				}}
			>
				<LegalContentRenderer content={content} />
			</Box>
		</Dialog>
	);
};
