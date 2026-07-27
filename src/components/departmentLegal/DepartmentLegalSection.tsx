import * as React from 'react';
import { useEffect, useState } from 'react';
import {
	Box,
	Button,
	CircularProgress,
	Collapse,
	Typography
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useTranslation } from 'react-i18next';
import {
	apiGetDepartmentLegal,
	DepartmentLegalData
} from '../../api/apiGetDepartmentLegal';
import {
	AgencyDataInterface,
	AgencyDepartmentDataInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { pickConsentPrivacyContent } from '../../utils/legalContent';
import { LegalContentRenderer } from '../legalContent/LegalContentRenderer';

export const getDepartmentForTopic = (
	agency?: AgencyDataInterface,
	topic?: TopicsDataInterface
): AgencyDepartmentDataInterface | undefined =>
	topic?.id !== undefined
		? agency?.departments?.find(
				(department) => department.topicId === topic.id
			)
		: undefined;

export interface DepartmentLegalSectionProps {
	agency?: AgencyDataInterface;
	topic?: TopicsDataInterface;
	/**
	 * 'details': expandable legal section inside the agency details panel -
	 * shown when the department has any published legal text.
	 * 'consent': data privacy display for the registration consent step -
	 * prefers the department's published DPP and falls back to the tenant
	 * privacy content when the department text cannot be loaded.
	 */
	variant?: 'details' | 'consent';
}

const topicDisplayName = (topic?: TopicsDataInterface): string =>
	topic?.titles?.long || topic?.name || '';

/**
 * Department identity + legal texts for a selected agency/topic pair.
 * Renders nothing when the backend does not provide `departments` (older
 * backends without AgencyService #90) or when no published text exists -
 * that keeps behavior identical to today when the feature is absent.
 * The legal endpoint is only requested once the user expands the section.
 */
export const DepartmentLegalSection = ({
	agency,
	topic,
	variant = 'details'
}: DepartmentLegalSectionProps) => {
	const { t } = useTranslation();
	const tenant = useTenant();
	const [open, setOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [legal, setLegal] = useState<DepartmentLegalData | null>(null);
	const [hasLoaded, setHasLoaded] = useState(false);

	const department = getDepartmentForTopic(agency, topic);
	const hasPublishedDpp = department?.hasPublishedDpp === true;
	const hasPublishedImprint = department?.hasPublishedImprint === true;
	const isVisible =
		variant === 'consent'
			? hasPublishedDpp
			: hasPublishedDpp || hasPublishedImprint;

	// Lazy-load the public legal endpoint on first expand only
	useEffect(() => {
		if (!open || hasLoaded || !isVisible || !agency?.id || !topic?.id) {
			return;
		}
		const abortController = new AbortController();
		setIsLoading(true);
		apiGetDepartmentLegal(agency.id, topic.id, abortController.signal)
			.then((data) => {
				setLegal(data);
				setHasLoaded(true);
			})
			.finally(() => setIsLoading(false));
		return () => abortController.abort();
	}, [open, hasLoaded, isVisible, agency?.id, topic?.id]);

	if (!isVisible) {
		return null;
	}

	const dppContent = legal?.dpp?.content;
	const imprintContent = legal?.imprint?.content;
	// Consent display: department DPP wins, tenant content is the fallback
	// (e.g. when the endpoint 404s on a backend without AgencyService #90).
	const consentContent =
		variant === 'consent'
			? pickConsentPrivacyContent(dppContent, tenant?.content?.privacy)
			: null;

	const nothingLoaded =
		hasLoaded &&
		(variant === 'consent'
			? !consentContent?.content
			: !dppContent && !imprintContent);

	return (
		<Box data-cy={`department-legal-${variant}`} sx={{ width: '100%' }}>
			<Button
				type="button"
				aria-expanded={open}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					setOpen((current) => !current);
				}}
				endIcon={
					<ExpandMoreRoundedIcon
						sx={{
							transform: open ? 'rotate(180deg)' : 'none',
							transition: 'transform 160ms ease'
						}}
					/>
				}
				sx={{
					px: 0,
					fontWeight: 700,
					fontSize: 14,
					textTransform: 'none'
				}}
			>
				{t(
					'registration.agency.legal.headline',
					'Datenschutzhinweise der Beratungsstelle'
				)}
			</Button>
			{topicDisplayName(topic) && (
				<Typography
					variant="body2"
					sx={{ color: 'text.secondary', mt: 0.25 }}
				>
					{t('registration.agency.legal.department', 'Fachbereich')}
					{': '}
					{topicDisplayName(topic)}
				</Typography>
			)}
			<Collapse in={open} timeout="auto" unmountOnExit>
				<Box
					onClick={(event) => event.stopPropagation()}
					sx={{ pt: 1.5, pb: 0.5 }}
				>
					{isLoading && (
						<CircularProgress size={20} aria-label="loading" />
					)}
					{nothingLoaded && (
						<Typography variant="body2">
							{t(
								'registration.agency.legal.unavailable',
								'Die Datenschutzhinweise können derzeit nicht geladen werden.'
							)}
						</Typography>
					)}
					{variant === 'consent' ? (
						// Render only once the department fetch settled so the
						// tenant fallback does not flash before the result.
						hasLoaded &&
						consentContent?.content && (
							<LegalContentRenderer
								content={consentContent.content}
							/>
						)
					) : (
						<>
							{dppContent && (
								<LegalContentRenderer content={dppContent} />
							)}
							{imprintContent && (
								<>
									<Typography
										variant="subtitle2"
										sx={{ fontWeight: 700, mt: 2, mb: 1 }}
									>
										{t(
											'registration.agency.legal.imprintHeadline',
											'Impressum der Beratungsstelle'
										)}
									</Typography>
									<LegalContentRenderer
										content={imprintContent}
									/>
								</>
							)}
						</>
					)}
				</Box>
			</Collapse>
		</Box>
	);
};
