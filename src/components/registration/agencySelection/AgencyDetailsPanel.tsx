import * as React from 'react';
import { Box, Collapse, Link, Typography } from '@mui/material';
import { useMemo, type ReactNode } from 'react';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import NavigationRoundedIcon from '@mui/icons-material/NavigationRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import { useTranslation } from 'react-i18next';
import { AgencyDataInterface } from '../../../globalState/interfaces';
import { registrationMd3 } from '../registrationDesign/registrationDesign';
import { AgencyLanguages } from './AgencyLanguages';

interface AgencyDetailsPanelProps {
	agency: AgencyDataInterface;
	open: boolean;
}

interface AgencyDetails {
	address?: string;
	lat?: number;
	lng?: number;
	phone?: string;
	hours?: string;
	about?: string;
	url?: string;
}

type AgencyRecord = AgencyDataInterface & Record<string, unknown>;

const DEMO_DETAILS: {
	match: RegExp;
	details: AgencyDetails;
}[] = [
	{
		match: /caritasverband wismar/i,
		details: {
			address: 'Hinter dem Rathaus 4, 23966 Wismar',
			lat: 53.8932,
			lng: 11.4651,
			phone: '03841 32 70 0',
			hours: 'Mo-Fr 8-16 Uhr',
			about: 'Beratung zu Familie, Finanzen und Migration. Termine nach Vereinbarung, auch telefonisch.'
		}
	},
	{
		match: /caritas agency|caritas am meer/i,
		details: {
			address: 'Bademutterstraße 12, 23966 Wismar',
			lat: 53.892,
			lng: 11.4628,
			phone: '03841 22 55 0',
			hours: 'Mo-Do 9-17 Uhr · Fr 9-13 Uhr',
			about: 'Allgemeine soziale Beratung mit offener Sprechstunde ohne Termin. Der Zugang ist barrierefrei.'
		}
	},
	{
		match: /kreuzberg/i,
		details: {
			address: 'Skalitzer Straße 47, 10997 Berlin',
			lat: 52.5006,
			lng: 13.4246,
			phone: '030 666 33 0',
			hours: 'Mo-Do 9-17 Uhr · Fr 9-13 Uhr',
			about: 'Lokale Beratung mit vertraulicher Online-Begleitung und optionaler Anbindung an Hilfen vor Ort.'
		}
	},
	{
		match: /u25/i,
		details: {
			address: 'Hohenstaufenring 2, 50674 Köln',
			lat: 50.9352,
			lng: 6.9378,
			phone: '0221 95 41 21 0',
			hours: 'Mo-Fr 9-16 Uhr',
			about: 'Anonyme Begleitung für junge Menschen in Krisen und bei Suizidgedanken.'
		}
	},
	{
		match: /codex predev|predev e2e/i,
		details: {
			address: 'Teststandort, 50667 Köln',
			lat: 50.9384,
			lng: 6.9599,
			phone: '0221 000 000',
			hours: 'Mo-Fr 9-16 Uhr',
			about: 'PreDev-Testdaten für die End-to-End-Validierung der Registrierung.'
		}
	}
];

const COLOGNE_CENTER = {
	lat: 50.9384,
	lng: 6.9599
};

function firstString(record: AgencyRecord, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return undefined;
}

function firstNumber(record: AgencyRecord, keys: string[]): number | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === 'string' && value.trim()) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
	}
	return undefined;
}

function getDemoDetails(
	agency: AgencyDataInterface
): AgencyDetails | undefined {
	return DEMO_DETAILS.find(({ match }) => match.test(agency.name || ''))
		?.details;
}

function postcodeCity(agency: AgencyDataInterface): string | undefined {
	const parts = [agency.postcode, agency.city].filter(Boolean);
	return parts.length > 0 ? parts.join(' ') : undefined;
}

function getAgencyDetails(agency: AgencyDataInterface): AgencyDetails {
	const record = agency as AgencyRecord;
	const demoDetails = getDemoDetails(agency);
	const realAddress = firstString(record, [
		'address',
		'street',
		'streetName',
		'location'
	]);
	const lat = firstNumber(record, ['lat', 'latitude']);
	const lng = firstNumber(record, ['lng', 'lon', 'longitude']);
	const postcodeArea: Partial<Pick<AgencyDetails, 'lat' | 'lng'>> =
		!lat && !lng && agency.postcode === '50667' ? COLOGNE_CENTER : {};

	return {
		address: realAddress || demoDetails?.address || postcodeCity(agency),
		lat: lat ?? demoDetails?.lat ?? postcodeArea.lat,
		lng: lng ?? demoDetails?.lng ?? postcodeArea.lng,
		phone:
			firstString(record, ['phone', 'telephone', 'phoneNumber']) ||
			demoDetails?.phone,
		hours:
			firstString(record, [
				'openingHours',
				'officeHours',
				'consultingHours'
			]) || demoDetails?.hours,
		about: agency.description || demoDetails?.about,
		url: agency.url || demoDetails?.url
	};
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
	const details = useMemo(() => getAgencyDetails(agency), [agency]);
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
				{details.address && (
					<InfoRow
						icon={<PlaceRoundedIcon fontSize="small" />}
						label={t(
							'registration.agency.details.addressLabel',
							'Adresse'
						)}
					>
						<Box>{details.address}</Box>
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
			</Box>
		</Collapse>
	);
};
