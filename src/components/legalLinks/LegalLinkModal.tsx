import * as React from 'react';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { useTenant } from '../../globalState/provider/TenantProvider';
import htmlParser from '../../resources/scripts/util/htmlParser';
import { OrisoDialog } from '../modal/OrisoDialog';
import './legalLinkModal.styles';

type LegalLinkModalKind = 'imprint' | 'privacy';

type LegalLinkModalProps = {
	title: string;
	url: string;
	onClose: () => void;
};

export const LegalLinkModal = ({
	title,
	url,
	onClose
}: LegalLinkModalProps) => {
	const tenant = useTenant();
	const kind = getLegalModalKind(title, url);
	const modalTitle =
		kind === 'privacy' ? 'Datenschutz-erklärung' : 'Impressum';
	const content =
		kind === 'privacy'
			? tenant?.content?.privacy || FIGMA_LEGAL_CONTENT
			: tenant?.content?.impressum || FIGMA_LEGAL_CONTENT;

	return (
		<OrisoDialog
			open
			title={modalTitle}
			icon={
				kind === 'privacy' ? (
					<DescriptionOutlinedIcon />
				) : (
					<FingerprintIcon />
				)
			}
			onClose={onClose}
			backLabel="Zurück"
			confirmLabel="Verstanden"
		>
			<div className="legalLinkModal__content">{htmlParser(content)}</div>
		</OrisoDialog>
	);
};

const getLegalModalKind = (title: string, url: string): LegalLinkModalKind => {
	const source = `${title} ${url}`.toLowerCase();
	return source.includes('daten') ||
		source.includes('privacy') ||
		source.includes('datenschutz')
		? 'privacy'
		: 'imprint';
};

const FIGMA_LEGAL_CONTENT = `
	<p>FULL CONSENT AGREEMENT</p>
	<p>&nbsp;</p>
	<p>Basic Information</p>
	<p>I, {{USERNAME}}, hereby consent to the disclosure and processing of my personal data, including sensitive data and documents uploaded by me, as provided in the request and completed questionnaire, by WeCare Remote, operated by Sunflower Care e.V. (hereinafter referred to as "WeCare Remote"), to the organisation {{ORGANISATION NAME}} and its consultants responsible for my case, as well as to volunteers engaged by this organisation, for the purpose of providing advice and processing my request.</p>
	<p>Data Hosting and Storage Information</p>
	<p>&nbsp;</p>
	<p>Data Hosting: WeCare Remote (wcr.is) hosts and secures all your data</p>
	<p>Storage Location: Data is stored on servers in Germany, specifically on Amazon Web Services and Microsoft Azure</p>
	<p>Privacy Policies: Privacy Policy | Terms of Service</p>
	<p>What This Means For Your Case</p>
	<p>I understand that consultants from {{ORGANISATION NAME}} may view my data and will contact me to provide advice</p>
	<p>I am aware that {{ORGANISATION NAME}} may process my data outside the WeCare Remote platform after taking over the case</p>
	<p>The responsibility for complying with data protection regulations in this further processing lies with {{ORGANISATION NAME}}</p>
	<p>Categories of Data Covered By This Consent</p>
	<p>All information provided by me in the questionnaire, including information on my:</p>
	<p>Health</p>
	<p>Origin</p>
	<p>Residence status</p>
	<p>Other sensitive areas of life</p>
	<p>All documents uploaded by me, such as:</p>
	<p>Identification documents</p>
	<p>Official notices</p>
	<p>Medical records</p>
	<p>Other case-related materials</p>
	<p>Special Category Data (Article 9 GDPR)</p>
	<p>The data I voluntarily upload may include special categories of personal data according to Article 9 GDPR, including data revealing:</p>
	<p>Racial or ethnic origin</p>
	<p>Political opinions</p>
	<p>Religious or philosophical beliefs</p>
	<p>Trade union membership</p>
	<p>Genetic or biometric data</p>
	<p>Health data</p>
	<p>Data concerning sex life or sexual orientation</p>
	<p>With my consent, I explicitly agree that these special categories of personal data may be disclosed to {{ORGANISATION NAME}} and processed within the scope of consultation.</p>
	<p>Data Protection Guarantees</p>
	<p>{{ORGANISATION NAME}} is obligated to treat my data confidentially</p>
	<p>My data will only be used for the personal and time-limited consultation</p>
	<p>Disclosure to unauthorised third parties is prohibited</p>
	<p>After completing the consultation, my data will be deleted when possible, but no later than 365 days</p>
	<p>Voluntary Consent and Withdrawal Rights</p>
	<p>This consent is voluntary. I can withdraw it at any time with effect for the future without incurring any disadvantages. The withdrawal should be addressed to: info@wcr.is</p>
	<p>Note: The withdrawal of consent does not affect the lawfulness of processing based on consent before its withdrawal.</p>
	<p>Confirmation</p>
	<p>By clicking the "yes" button to accept my case by {{ORGANISATION NAME}}, I confirm that I have read and understood the above consent declaration and agree to the disclosure and processing of my data as described.</p>
	<p>Helpful Resources:</p>
	<p>UK Information Commissioner's Office - Your Data Matters</p>
	<p>European Data Protection Board</p>
	<p>German Federal Commissioner for Data Protection</p>
`;
