import * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { SvgIconComponent } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../registrationDesign/registrationDesign';

const CANONICAL_STEPS: {
	name: string;
	labelKey: string;
	fallback: string;
	Icon: SvgIconComponent;
}[] = [
	{
		name: 'topic-selection',
		labelKey: 'registration.md3.stepNames.focus',
		fallback: 'Fokus wählen',
		Icon: CenterFocusStrongRoundedIcon
	},
	{
		name: 'zipcode',
		labelKey: 'registration.md3.stepNames.postcode',
		fallback: 'Postleitzahl',
		Icon: PlaceRoundedIcon
	},
	{
		name: 'agency-selection',
		labelKey: 'registration.md3.stepNames.agency',
		fallback: 'Beratungsstelle',
		Icon: ApartmentRoundedIcon
	},
	{
		name: 'account-data',
		labelKey: 'registration.md3.stepNames.register',
		fallback: 'Registrieren',
		Icon: HowToRegRoundedIcon
	},
	{
		name: 'request',
		labelKey: 'registration.md3.stepNames.request',
		fallback: 'Anfrage stellen',
		Icon: ChatBubbleRoundedIcon
	}
];

export const RegistrationStepper = ({
	currentStepName
}: {
	currentStepName: string;
}) => {
	const { t } = useTranslation();
	const activeRef = useRef<HTMLDivElement>(null);
	const currentIndex = useMemo(() => {
		const index = CANONICAL_STEPS.findIndex(
			({ name }) => name === currentStepName
		);
		return index >= 0 ? index : 0;
	}, [currentStepName]);

	useEffect(() => {
		activeRef.current?.scrollIntoView({
			behavior: 'smooth',
			inline: 'center',
			block: 'nearest'
		});
	}, [currentIndex]);

	return (
		<Box
			sx={{
				width: '100%',
				borderBottom: `1px solid ${registrationMd3.outlineVariant}`,
				pb: { xs: 1.5, md: 2 },
				mb: { xs: 2, md: 3 }
			}}
		>
			<Typography
				sx={{
					fontSize: 12,
					fontWeight: 700,
					letterSpacing: 1.2,
					textTransform: 'uppercase',
					color: registrationMd3.onSurfaceVariant,
					mb: 1
				}}
			>
				{t('registration.headline')}
			</Typography>
			<Box
				sx={{
					'display': 'flex',
					'alignItems': 'flex-start',
					'overflowX': { xs: 'auto', md: 'visible' },
					'pb': { xs: 0.5, md: 0 },
					'scrollbarWidth': 'none',
					'&::-webkit-scrollbar': { display: 'none' }
				}}
			>
				{CANONICAL_STEPS.map(
					({ name, labelKey, fallback, Icon }, i) => {
						const done = i < currentIndex;
						const active = i === currentIndex;
						const label = t(labelKey, fallback);

						return (
							<Box key={name} sx={{ display: 'contents' }}>
								<Box
									ref={active ? activeRef : undefined}
									aria-current={active ? 'step' : undefined}
									sx={{
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										gap: 0.5,
										width: { xs: 86, md: 112 },
										flexShrink: 0,
										borderRadius: 2
									}}
								>
									<Box
										sx={{
											width: { xs: 36, md: 44 },
											height: { xs: 36, md: 44 },
											borderRadius: '50%',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											bgcolor:
												done || active
													? registrationMd3.primary
													: registrationMd3.surfaceContainerHigh,
											color:
												done || active
													? '#fff'
													: registrationMd3.onSurfaceVariant,
											border:
												done || active
													? 'none'
													: `1.5px solid ${registrationMd3.outlineVariant}`,
											boxShadow: active
												? `0 0 0 5px ${registrationMd3.selectedLayer}`
												: 'none',
											transition: 'all .2s ease'
										}}
									>
										{done ? (
											<CheckRoundedIcon
												sx={{ fontSize: 22 }}
											/>
										) : (
											<Icon sx={{ fontSize: 22 }} />
										)}
									</Box>
									<Typography
										sx={{
											fontSize: { xs: 11, md: 13 },
											fontWeight: active ? 700 : 600,
											color: active
												? registrationMd3.primary
												: registrationMd3.onSurfaceVariant,
											lineHeight: 1.15,
											textAlign: 'center',
											overflowWrap: 'normal',
											wordBreak: 'keep-all',
											hyphens: 'none'
										}}
									>
										{label}
									</Typography>
								</Box>
								{i < CANONICAL_STEPS.length - 1 && (
									<Box
										aria-hidden
										sx={{
											flexGrow: 1,
											flexShrink: 0,
											minWidth: { xs: 18, md: 24 },
											mt: { xs: '17px', md: '21px' },
											mx: 0.5,
											borderTop: done
												? `3px solid ${registrationMd3.primary}`
												: `2.5px dotted ${registrationMd3.outlineVariant}`
										}}
									/>
								)}
							</Box>
						);
					}
				)}
			</Box>
		</Box>
	);
};
