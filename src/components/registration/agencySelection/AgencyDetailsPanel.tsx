import * as React from 'react';
import { Box, Collapse, Link, Typography } from '@mui/material';
import { useContext, useMemo, type ReactNode } from 'react';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import NavigationRoundedIcon from '@mui/icons-material/NavigationRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';
import { useTranslation } from 'react-i18next';
import { RegistrationContext } from '../../../globalState';
import { AgencyDataInterface } from '../../../globalState/interfaces';
import { registrationMd3 } from '../registrationDesign/registrationDesign';
import { AgencyLanguages } from './AgencyLanguages';
import { AgencyDetails, getAgencyDetails } from './agencyDetails';
import {
	DepartmentLegalSection,
	getDepartmentForTopic
} from '../../departmentLegal/DepartmentLegalSection';

interface AgencyDetailsPanelProps {
	agency: AgencyDataInterface;
	open: boolean;
}

function osmEmbedSrc(details: AgencyDetails): string | undefined {
	if (!details.lat || !details.lng) {
		return undefined;
	}
	const delta = 0.005;
	const bbox = `${details.lng - delta},${details.lat - delta},${details.lng + delta},${details.lat + delta}`;
	return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
		bbox
	)}&layer=mapnik&marker=${details.lat}%2C${details.lng}`;
}

function osmLink(details: AgencyDetails): string | undefined {
	if (!details.lat || !details.lng) {
		return undefined;
	}
	return `https://www.openstreetmap.org/?mlat=${details.lat}&mlon=${details.lng}#map=17/${details.lat}/${details.lng}`;
}

function nativeNavHref(
	details: AgencyDetails,
	agencyName: string
): string | undefined {
	if (!details.lat || !details.lng) {
		return undefined;
	}
	const label = encodeURIComponent(agencyName);
	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	if (/iPhone|iPad|iPod/.test(ua)) {
		return `https://maps.apple.com/?ll=${details.lat},${details.lng}&q=${label}`;
	}
	if (/Android/.test(ua)) {
		return `geo:${details.lat},${details.lng}?q=${details.lat},${details.lng}(${label})`;
	}
	return osmLink(details);
}

function safeWebUrl(url: string | undefined): string | undefined {
	if (!url) {
		return undefined;
	}

	try {
		const parsed = new URL(url, 'https://oriso.org');
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			return undefined;
		}

		return parsed.href;
	} catch {
		return undefined;
	}
}

const mapActionSx = {
	'display': 'inline-flex',
	'alignItems': 'center',
	'gap': 0.5,
	'color': registrationMd3.primary,
	'fontWeight': 700,
	'fontSize': 14,
	'textDecoration': 'none',
	'&:hover': { textDecoration: 'underline' },
	'&:focus-visible': {
		outline: `2px solid ${registrationMd3.focus}`,
		outlineOffset: 2,
		borderRadius: 1
	}
} as const;

function InfoRow({
	icon,
	label,
	children
}: {
	icon: ReactNode;
	label: string;
	children: ReactNode;
}) {
	return (
		<Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
			<Box
				aria-hidden
				sx={{
					color: registrationMd3.onSurfaceVariant,
					display: 'flex',
					mt: '2px'
				}}
			>
				{icon}
			</Box>
			<Box sx={{ minWidth: 0 }}>
				<Typography
					variant="caption"
					sx={{
						display: 'block',
						color: registrationMd3.onSurfaceVariant,
						fontWeight: 700,
						letterSpacing: 0.4,
						lineHeight: 1.4,
						textTransform: 'uppercase'
					}}
				>
					{label}
				</Typography>
				<Box
					sx={{
						color: registrationMd3.onSurface,
						fontSize: 15,
						lineHeight: 1.5
					}}
				>
					{children}
				</Box>
			</Box>
		</Box>
	);
}

export const AgencyDetailsPanel = ({
	agency,
	open
}: AgencyDetailsPanelProps) => {
	const { t } = useTranslation();
	const { registrationData } = useContext(RegistrationContext);
	const selectedTopic = registrationData?.mainTopic;
	const department = getDepartmentForTopic(agency, selectedTopic);
	const hasDepartmentLegal =
		department?.hasPublishedDpp === true ||
		department?.hasPublishedImprint === true;
	const details = useMemo(
		() => getAgencyDetails(agency, department),
		[agency, department]
	);
	const mapSrc = useMemo(() => osmEmbedSrc(details), [details]);
	const webMapHref = useMemo(() => osmLink(details), [details]);
	const nativeMapHref = useMemo(
		() => nativeNavHref(details, agency.name),
		[agency.name, details]
	);
	const safeDetailsUrl = useMemo(
		() => safeWebUrl(details.url),
		[details.url]
	);

	return (
		<Collapse in={open} timeout="auto" unmountOnExit>
			<Box
				onClick={(event) => event.stopPropagation()}
				sx={{
					display: 'grid',
					gap: 1.75,
					pt: 1.5,
					pb: 0.25,
					ml: { xs: 0, sm: 'calc(48px + 14px)' }
				}}
			>
				{(details.address || details.floorLocation) && (
					<InfoRow
						icon={<PlaceRoundedIcon fontSize="small" />}
						label={t(
							'registration.agency.details.addressLabel',
							'Adresse'
						)}
					>
						{details.address && <Box>{details.address}</Box>}
						{details.floorLocation && (
							<Box>{details.floorLocation}</Box>
						)}
						{(webMapHref || nativeMapHref) && (
							<Box
								sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 2,
									mt: 0.75
								}}
							>
								{webMapHref && (
									<Link
										href={webMapHref}
										target="_blank"
										rel="noopener noreferrer"
										sx={mapActionSx}
									>
										{t(
											'registration.agency.details.openInMaps',
											'In Karte öffnen'
										)}
										<OpenInNewRoundedIcon
											sx={{ fontSize: 16 }}
										/>
									</Link>
								)}
								{nativeMapHref && (
									<Link
										href={nativeMapHref}
										sx={{
											...mapActionSx,
											display: {
												xs: 'inline-flex',
												sm: 'none'
											}
										}}
									>
										{t(
											'registration.agency.details.navigate',
											'Navigation starten'
										)}
										<NavigationRoundedIcon
											sx={{ fontSize: 16 }}
										/>
									</Link>
								)}
							</Box>
						)}
					</InfoRow>
				)}

				{mapSrc && (
					<Box
						sx={{
							'width': '100%',
							'height': { xs: 172, sm: 190 },
							'minHeight': 150,
							'maxHeight': 360,
							'resize': 'vertical',
							'overflow': 'auto',
							'border': `1px solid ${registrationMd3.outlineVariant}`,
							'borderRadius': '12px',
							'position': 'relative',
							'backgroundColor': registrationMd3.surface,
							'&::after': {
								content: '""',
								position: 'absolute',
								right: 4,
								bottom: 4,
								width: 12,
								height: 12,
								borderRight: `2px solid ${registrationMd3.primary}`,
								borderBottom: `2px solid ${registrationMd3.primary}`,
								pointerEvents: 'none'
							}
						}}
					>
						<Box
							component="iframe"
							title={`${t(
								'registration.agency.details.openInMaps',
								'In Karte öffnen'
							)} - ${agency.name}`}
							src={mapSrc}
							loading="lazy"
							sx={{
								display: 'block',
								width: '100%',
								height: '100%',
								border: 0,
								borderRadius: '11px'
							}}
						/>
					</Box>
				)}

				<InfoRow
					icon={<TranslateRoundedIcon fontSize="small" />}
					label={t(
						'registration.agency.details.languagesLabel',
						'Sprachen'
					)}
				>
					<AgencyLanguages agencyId={agency.id} />
				</InfoRow>

				{details.hours && (
					<InfoRow
						icon={<ScheduleRoundedIcon fontSize="small" />}
						label={t(
							'registration.agency.details.hoursLabel',
							'Öffnungszeiten'
						)}
					>
						{details.hours}
					</InfoRow>
				)}

				{details.phone && (
					<InfoRow
						icon={<CallRoundedIcon fontSize="small" />}
						label={t(
							'registration.agency.details.phoneLabel',
							'Telefon'
						)}
					>
						<Link
							href={`tel:${details.phone.replace(/\s/g, '')}`}
							sx={{
								'color': registrationMd3.onSurface,
								'textDecoration': 'none',
								'&:hover': { textDecoration: 'underline' }
							}}
						>
							{details.phone}
						</Link>
					</InfoRow>
				)}

				{safeDetailsUrl && (
					<InfoRow
						icon={<LanguageRoundedIcon fontSize="small" />}
						label={t(
							'registration.agency.details.websiteLabel',
							'Webseite'
						)}
					>
						<Link
							href={safeDetailsUrl}
							target="_blank"
							rel="noopener noreferrer"
							sx={mapActionSx}
						>
							{safeDetailsUrl}
							<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
						</Link>
					</InfoRow>
				)}

				{details.about && (
					<InfoRow
						icon={<InfoOutlinedIcon fontSize="small" />}
						label={t(
							'registration.agency.details.aboutLabel',
							'Zu dieser Beratungsstelle'
						)}
					>
						{details.about}
					</InfoRow>
				)}

				{hasDepartmentLegal && (
					<InfoRow
						icon={<PrivacyTipOutlinedIcon fontSize="small" />}
						label={t(
							'registration.agency.legal.label',
							'Rechtliches'
						)}
					>
						<DepartmentLegalSection
							agency={agency}
							topic={selectedTopic}
						/>
					</InfoRow>
				)}
			</Box>
		</Collapse>
	);
};
