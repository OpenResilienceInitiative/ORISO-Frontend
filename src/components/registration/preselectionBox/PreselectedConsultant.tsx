import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { useContext } from 'react';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';

const PreselectedConsultant = ({ hasError }: { hasError: boolean }) => {
	const { t } = useTranslation();
	const { consultant } = useContext(UrlParamsContext);

	if (hasError) {
		return (
			<Typography>
				<ReportProblemIcon
					aria-hidden="true"
					color="inherit"
					sx={{
						width: '20px',
						height: '20px',
						mr: '8px',
						color: '#FF9F00'
					}}
				/>
				{t('registration.errors.cid')}
			</Typography>
		);
	}

	if (consultant?.absent) {
		return (
			<>
				<Typography>
					{t(
						'registration.consultantlinkAbsent',
						'This counselor is currently absent. You can still send your request to the counseling center.'
					)}
				</Typography>
				{consultant.absenceMessage && (
					<Typography sx={{ mt: '8px' }}>
						{consultant.absenceMessage}
					</Typography>
				)}
			</>
		);
	}

	return <Typography>{t('registration.consultantlink')}</Typography>;
};

export default PreselectedConsultant;
