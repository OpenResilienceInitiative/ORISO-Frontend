import * as React from 'react';
import { SelectChangeEvent } from '@mui/material/Select';
import { Consultant } from '../../api/apiGetAgencyConsultantList';
import { OrisoSelect } from '../form/OrisoSelect';

export type SupervisorDirectoryState = 'loading' | 'ready' | 'error';

type SupervisorConsultantPickerProps = {
	state: SupervisorDirectoryState;
	consultants: Consultant[];
	selectedConsultantId: string;
	onChange: (consultantId: string) => void;
	labels: {
		loading: string;
		error: string;
		empty: string;
		select: string;
	};
};

const getConsultantLabel = (consultant: Consultant): string =>
	[consultant.firstName, consultant.lastName].filter(Boolean).join(' ') ||
	consultant.displayName ||
	consultant.username ||
	consultant.consultantId;

export const SupervisorConsultantPicker = ({
	state,
	consultants,
	selectedConsultantId,
	onChange,
	labels
}: SupervisorConsultantPickerProps) => {
	if (state === 'loading') {
		return <div role="status">{labels.loading}</div>;
	}

	if (state === 'error') {
		return <div role="alert">{labels.error}</div>;
	}

	if (consultants.length === 0) {
		return <div>{labels.empty}</div>;
	}

	const handleChange = (event: SelectChangeEvent<string>) => {
		onChange(event.target.value);
	};

	return (
		<OrisoSelect
			id="supervisor-consultant-select"
			label={labels.select}
			options={consultants.map((consultant) => ({
				value: consultant.consultantId,
				label: getConsultantLabel(consultant)
			}))}
			value={selectedConsultantId}
			onChange={handleChange}
		/>
	);
};
