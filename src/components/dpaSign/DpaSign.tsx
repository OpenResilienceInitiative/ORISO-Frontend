import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import {
	Alert,
	Box,
	Button,
	Checkbox,
	FormControlLabel,
	MenuItem,
	Paper,
	TextField,
	Typography
} from '@mui/material';
import * as React from 'react';
import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
	apiConfirmDpaSignature,
	DPA_SIGN_ERRORS
} from '../../api/apiDpaSignature';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

interface FormState {
	signerName: string;
	signerPosition: string;
	signerEmail: string;
	signerOrganisation: string;
	language: string;
	accepted: boolean;
}

const INITIAL_FORM_STATE: FormState = {
	signerName: '',
	signerPosition: '',
	signerEmail: '',
	signerOrganisation: '',
	language: 'de',
	accepted: false
};

export const DpaSign = () => {
	const { token } = useParams<{ token: string }>();
	const { t } = useTranslation();
	const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
	const [submitState, setSubmitState] = useState<SubmitState>('idle');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const decodedToken = useMemo(
		() => (token ? decodeURIComponent(token) : ''),
		[token]
	);

	const updateField = <K extends keyof FormState>(
		field: K,
		value: FormState[K]
	) => {
		setFormState((current) => ({
			...current,
			[field]: value
		}));
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage(null);

		if (!decodedToken) {
			setSubmitState('error');
			setErrorMessage(
				t(
					'dpaSign.error.missingToken',
					'Der Signaturlink ist unvollständig.'
				)
			);
			return;
		}

		if (!formState.accepted) {
			setSubmitState('error');
			setErrorMessage(
				t(
					'dpaSign.error.acceptRequired',
					'Bitte bestätigen Sie die Vereinbarung.'
				)
			);
			return;
		}

		setSubmitState('submitting');

		try {
			await apiConfirmDpaSignature(decodedToken, {
				...formState,
				signerIsMember: false,
				source: 'PUBLIC_SIGN_LINK'
			});
			setSubmitState('success');
		} catch (error) {
			setSubmitState('error');
			setErrorMessage(resolveErrorMessage(error, t));
		}
	};

	return (
		<Box
			component="main"
			sx={{
				minHeight: '100vh',
				background: 'var(--m3-surface, #f8faf9)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				px: 2,
				py: 4
			}}
		>
			<Paper
				component="form"
				elevation={0}
				onSubmit={handleSubmit}
				sx={{
					width: '100%',
					maxWidth: 560,
					border: '1px solid var(--m3-outline-variant, #dce5df)',
					borderRadius: 2,
					p: { xs: 3, sm: 4 },
					display: 'grid',
					gap: 2
				}}
			>
				<Box>
					<Typography variant="h4" component="h1" gutterBottom>
						{t('dpaSign.title', 'AVV unterzeichnen')}
					</Typography>
					<Typography color="text.secondary">
						{t(
							'dpaSign.subtitle',
							'Bitte prüfen und bestätigen Sie die Angaben zur unterzeichnenden Person.'
						)}
					</Typography>
				</Box>

				{submitState === 'success' ? (
					<Alert severity="success">
						{t(
							'dpaSign.success',
							'Die AVV-Signatur wurde gespeichert.'
						)}
					</Alert>
				) : (
					<>
						<TextField
							label={t('dpaSign.signerName', 'Name')}
							value={formState.signerName}
							onChange={(event) =>
								updateField('signerName', event.target.value)
							}
							required
							fullWidth
						/>
						<TextField
							label={t('dpaSign.signerPosition', 'Position')}
							value={formState.signerPosition}
							onChange={(event) =>
								updateField(
									'signerPosition',
									event.target.value
								)
							}
							required
							fullWidth
						/>
						<TextField
							label={t('dpaSign.signerEmail', 'E-Mail')}
							type="email"
							value={formState.signerEmail}
							onChange={(event) =>
								updateField('signerEmail', event.target.value)
							}
							required
							fullWidth
						/>
						<TextField
							label={t(
								'dpaSign.signerOrganisation',
								'Organisation'
							)}
							value={formState.signerOrganisation}
							onChange={(event) =>
								updateField(
									'signerOrganisation',
									event.target.value
								)
							}
							required
							fullWidth
						/>
						<TextField
							label={t('dpaSign.language', 'Sprache')}
							value={formState.language}
							onChange={(event) =>
								updateField('language', event.target.value)
							}
							required
							fullWidth
							select
						>
							<MenuItem value="de">Deutsch</MenuItem>
							<MenuItem value="en">English</MenuItem>
						</TextField>
						<FormControlLabel
							control={
								<Checkbox
									checked={formState.accepted}
									onChange={(event) =>
										updateField(
											'accepted',
											event.target.checked
										)
									}
									required
								/>
							}
							label={t(
								'dpaSign.accept',
								'Ich bestätige die Vereinbarung verbindlich.'
							)}
						/>
						{errorMessage && (
							<Alert severity="error">{errorMessage}</Alert>
						)}
						<Button
							type="submit"
							variant="contained"
							size="large"
							startIcon={<CheckRoundedIcon />}
							disabled={submitState === 'submitting'}
							sx={{ justifySelf: 'start' }}
						>
							{submitState === 'submitting'
								? t('dpaSign.submitting', 'Speichern...')
								: t('dpaSign.submit', 'Unterzeichnen')}
						</Button>
					</>
				)}
			</Paper>
		</Box>
	);
};

const resolveErrorMessage = (
	error: unknown,
	t: ReturnType<typeof useTranslation>['t']
) => {
	if (
		error instanceof Error &&
		error.message === DPA_SIGN_ERRORS.INVALID_OR_EXPIRED_TOKEN
	) {
		return t(
			'dpaSign.error.invalidToken',
			'Dieser Signaturlink ist ungültig, abgelaufen oder wurde bereits verwendet.'
		);
	}

	if (
		error instanceof Error &&
		error.message === DPA_SIGN_ERRORS.INVALID_REQUEST
	) {
		return t(
			'dpaSign.error.invalidRequest',
			'Die Angaben konnten nicht gespeichert werden. Bitte prüfen Sie das Formular.'
		);
	}

	return t(
		'dpaSign.error.generic',
		'Die Signatur konnte gerade nicht gespeichert werden.'
	);
};
