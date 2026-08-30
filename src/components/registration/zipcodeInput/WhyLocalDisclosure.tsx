import * as React from 'react';
import { useState } from 'react';
import { Box, Collapse, Typography, ButtonBase } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import ArrowDropUpRoundedIcon from '@mui/icons-material/ArrowDropUpRounded';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../registrationDesign/registrationDesign';
import {
	artworkFit,
	whyLocalArtwork
} from '../../../resources/img/registration-md3/registrationArtwork';

const REASONS = [
	{ key: 'localHelp', artwork: whyLocalArtwork.localHelp },
	{ key: 'stateLaw', artwork: whyLocalArtwork.stateLaw },
	{ key: 'anonymous', artwork: whyLocalArtwork.anonymous },
	{ key: 'inPerson', artwork: whyLocalArtwork.inPerson }
] as const;

/**
 * "Warum lokal beraten?" — collapsed by default, so the postcode step stays a
 * single question. Replaces the grey bullet box, which pushed the input below
 * the fold on a 375 pt screen and stated the same thing twice.
 *
 * The four motifs load lazily: they sit behind a closed disclosure, and the
 * step must be usable before any of them arrive.
 */
const PANEL_ID = 'why-local-panel';

export interface WhyLocalDisclosureProps {
	/** Start expanded. The flow keeps it closed; Storybook shows the content. */
	defaultOpen?: boolean;
}

export const WhyLocalDisclosure = ({
	defaultOpen = false
}: WhyLocalDisclosureProps = {}) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(defaultOpen);

	return (
		<Box
			data-cy="why-local-disclosure"
			sx={{
				width: '100%',
				borderRadius: '12px',
				overflow: 'hidden',
				bgcolor: open ? registrationMd3.surface : 'transparent',
				border: `1px solid ${
					open ? registrationMd3.outlineVariant : 'transparent'
				}`,
				transition:
					'background-color 160ms ease, border-color 160ms ease'
			}}
		>
			<ButtonBase
				onClick={() => setOpen((current) => !current)}
				aria-expanded={open}
				aria-controls={PANEL_ID}
				data-cy="why-local-toggle"
				sx={{
					'width': '100%',
					'minHeight': 56,
					'display': 'flex',
					'alignItems': 'center',
					'gap': 1.25,
					'px': 1.5,
					'py': 1,
					'textAlign': 'left',
					'borderRadius': '12px',
					// The other registration controls all define their ring
					// from the token set; the browser default is nearly
					// invisible on this white panel.
					'&:focus-visible': {
						boxShadow: `0 0 0 3px ${registrationMd3.focusLayer}`
					}
				}}
			>
				<InfoOutlinedIcon
					sx={{
						flexShrink: 0,
						fontSize: 24,
						color: registrationMd3.onSurfaceVariant
					}}
				/>
				<Typography
					component="span"
					sx={{
						flex: 1,
						fontSize: 14,
						lineHeight: '19px',
						fontWeight: 600,
						color: registrationMd3.onSurface
					}}
				>
					{t('registration.zipcode.whyLocal.title')}
				</Typography>
				{open ? (
					<ArrowDropUpRoundedIcon sx={{ flexShrink: 0 }} />
				) : (
					<ArrowDropDownRoundedIcon sx={{ flexShrink: 0 }} />
				)}
			</ButtonBase>
			<Collapse in={open} unmountOnExit id={PANEL_ID}>
				<Box
					sx={{
						px: 1.75,
						pb: 2,
						pt: 0.25,
						display: 'flex',
						flexDirection: 'column',
						gap: 1.75
					}}
				>
					{REASONS.map(({ key, artwork }) => (
						<Box
							key={key}
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 1.5
							}}
						>
							<Box
								component="img"
								src={artwork.src}
								alt=""
								loading="lazy"
								decoding="async"
								width={48}
								height={48}
								sx={{
									width: 48,
									height: 48,
									flexShrink: 0,
									borderRadius: '50%',
									objectFit: artworkFit(artwork),
									p: artwork.pending ? 1.25 : 0,
									opacity: artwork.pending ? 0.5 : 1,
									bgcolor: registrationMd3.surfaceContainer
								}}
							/>
							<Typography
								sx={{
									flex: 1,
									fontSize: 13,
									lineHeight: '19px',
									color: registrationMd3.onSurface
								}}
							>
								{t(`registration.zipcode.whyLocal.${key}`)}
							</Typography>
						</Box>
					))}
				</Box>
			</Collapse>
		</Box>
	);
};
