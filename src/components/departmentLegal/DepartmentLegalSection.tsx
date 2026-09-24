import * as React from 'react';
import { useState } from 'react';
import {
	Box,
	Button,
	CircularProgress,
	Collapse,
	Typography
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useTranslation } from 'react-i18next';
import { useDepartmentLegal } from '../../api/useDepartmentLegal';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { pickConsentPrivacyContent } from '../../utils/legalContent';
import { LegalContentRenderer } from '../legalContent/LegalContentRenderer';
import { getDepartmentForTopic } from './getDepartmentForTopic';

export { getDepartmentForTopic };

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

	const department = getDepartmentForTopic(agency, topic);
	const hasPublishedDpp = department?.hasPublishedDpp === true;
	const hasPublishedImprint = department?.hasPublishedImprint === true;
	const isVisible =
		variant === 'consent'
			? hasPublishedDpp
			: hasPublishedDpp || hasPublishedImprint;

	const fetchEnabled =
		open && isVisible && agency?.id != null && topic?.id != null;
	const { data: legal, loading: isLoading } = useDepartmentLegal(
		agency?.id,
		topic?.id,
		{ enabled: fetchEnabled }
	);
	const hasLoaded = fetchEnabled && !isLoading;

	if (!isVisible) {
		return null;
	}

	const dppContent = legal?.dpp?.content;
	const imprintContent = legal?.imprint?.content;
	/* Consent display: department DPP wins, tenant content is the fallback
	   (e.g. when the endpoint 404s on a backend without AgencyService #90).

	   `renderedPrivacy`, not `privacy`: the two differ by exactly the
	   data-protection placeholder rendering (TenantService `TenantConverter`,
	   `renderPrivacyForNoAgencyContext`). Passing the raw field put an
	   unsubstituted `${responsible}` in front of help-seekers at registration.
	   TenantService already falls back to the raw text when no contact template
	   is configured, so the `||` here only covers a backend that predates the
	   field entirely. */
	const consentContent =
		variant === 'consent'
			? pickConsentPrivacyContent(
					dppContent,
					tenant?.content?.renderedPrivacy || tenant?.content?.privacy
				)
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
				{t('registration.agency.legal.headline')}
			</Button>
			{topicDisplayName(topic) && (
				<Typography
					variant="body2"
					sx={{ color: 'text.secondary', mt: 0.25 }}
				>
					{t('registration.agency.legal.department')}
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
						<CircularProgress
							size={20}
							aria-label={t('registration.agency.legal.loading')}
						/>
					)}
					{nothingLoaded && (
						<Typography variant="body2">
							{t('registration.agency.legal.unavailable')}
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
											'registration.agency.legal.imprintHeadline'
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
