import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import {
	Alert,
	Box,
	Button,
	Checkbox,
	CircularProgress,
	Divider,
	FormControlLabel,
	MenuItem,
	Paper,
	TextField,
	Typography
} from '@mui/material';
import * as React from 'react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
	apiConfirmDpaSignature,
	apiGetDpaSignPreview,
	DpaSignPreviewResponse,
	DPA_SIGN_ERRORS
} from '../../api/apiDpaSignature';
import { LegalContentRenderer } from '../legalContent/LegalContentRenderer';

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

const DPA_DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

export const DpaSign = () => {
	const { token } = useParams<{ token: string }>();
	const { t } = useTranslation();
	const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
	const [submitState, setSubmitState] = useState<SubmitState>('idle');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [preview, setPreview] = useState<DpaSignPreviewResponse | null>(null);
	const [previewLoading, setPreviewLoading] = useState(true);

	const decodedToken = useMemo(
		() => (token ? decodeURIComponent(token) : ''),
		[token]
	);

	useEffect(() => {
		let active = true;
		setPreview(null);
		setPreviewLoading(true);
		setErrorMessage(null);

		if (!decodedToken) {
			setPreviewLoading(false);
			setErrorMessage(
				t(
					'dpaSign.error.missingToken',
					'Der Signaturlink ist unvollständig.'
				)
			);
			return () => {
				active = false;
			};
		}

		apiGetDpaSignPreview(decodedToken)
			.then((result) => {
				if (active) {
					setPreview(result);
				}
			})
			.catch((error) => {
				if (active) {
					setErrorMessage(resolveErrorMessage(error, t));
				}
			})
			.finally(() => {
				if (active) {
					setPreviewLoading(false);
				}
			});

		return () => {
			active = false;
		};
	}, [decodedToken, t]);

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

		if (!decodedToken || !preview) {
			setSubmitState('error');
			setErrorMessage(
				t(
					'dpaSign.error.previewRequired',
					'Die Vereinbarung muss vollständig geladen sein, bevor Sie sie bestätigen können.'
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
				background: 'var(--m3-surface-container-lowest, #f7f5f4)',
				display: 'flex',
				alignItems: 'flex-start',
				justifyContent: 'center',
				px: 2,
				py: { xs: 2, md: 6 }
			}}
		>
			<Paper
				component="form"
				elevation={0}
				onSubmit={handleSubmit}
				sx={{
					width: '100%',
					maxWidth: 1120,
					border: '1px solid var(--m3-outline-variant, #cac7c5)',
					borderRadius: 2,
					background: 'var(--m3-surface, #ffffff)',
					p: { xs: 2.5, sm: 4 },
					display: 'grid',
					gap: 3
				}}
			>
				<Box>
					<Typography variant="h4" component="h1" gutterBottom>
						{t('dpaSign.title', 'AVV unterzeichnen')}
					</Typography>
					<Typography color="text.secondary">
						{t(
							'dpaSign.subtitle',
							'Bitte lesen Sie die Vereinbarung vollständig und bestätigen Sie anschließend die Angaben zur unterzeichnenden Person.'
						)}
					</Typography>
				</Box>

				{previewLoading ? (
					<Box
						role="status"
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 2,
							minHeight: 240,
							color: 'text.secondary'
						}}
					>
						<CircularProgress size={24} />
						<Typography>
							{t(
								'dpaSign.loadingContract',
								'Vereinbarung wird geladen...'
							)}
						</Typography>
					</Box>
				) : !preview ? (
					<Alert severity="error">
						{errorMessage ??
							t(
								'dpaSign.error.generic',
								'Die Vereinbarung konnte gerade nicht geladen werden.'
							)}
					</Alert>
				) : (
					<Box
						sx={{
							display: 'grid',
							gridTemplateColumns: {
								xs: 'minmax(0, 1fr)',
								md: 'minmax(0, 1.2fr) minmax(360px, 0.8fr)'
							},
							gap: { xs: 3, md: 4 },
							alignItems: 'start'
						}}
					>
						<Box
							component="section"
							aria-labelledby="dpa-contract-heading"
							sx={{
								background:
									'var(--m3-surface-container-low, #f3f1f0)',
								border: '1px solid var(--m3-outline-variant, #d7d3d1)',
								borderRadius: 2,
								p: { xs: 2, sm: 3 }
							}}
						>
							<Typography
								variant="overline"
								color="text.secondary"
							>
								{preview.tenantName}
							</Typography>
							<Typography
								id="dpa-contract-heading"
								variant="h5"
								component="h2"
							>
								{t(
									'dpaSign.contractHeading',
									'Auftragsverarbeitungsvereinbarung'
								)}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{t('dpaSign.version', 'Vertragsversion')}{' '}
								{formatDpaDate(
									preview.dpaVersion,
									formState.language
								)}
							</Typography>
							<Divider sx={{ my: 2 }} />
							<Box
								sx={{
									maxHeight: { xs: 300, md: 520 },
									overflowY: 'auto',
									pr: 1
								}}
							>
								<LegalContentRenderer
									content={preview.content}
									language={formState.language}
								/>
							</Box>
						</Box>

						<Box
							component="section"
							aria-labelledby="dpa-signer-heading"
							sx={{ display: 'grid', gap: 2 }}
						>
							<Typography
								id="dpa-signer-heading"
								variant="h5"
								component="h2"
							>
								{t(
									'dpaSign.signerHeading',
									'Bestätigung der vertretungsberechtigten Person'
								)}
							</Typography>
							{submitState === 'success' ? (
								<Alert severity="success">
									{t(
										'dpaSign.success',
										'Die AVV-Bestätigung wurde gespeichert.'
									)}
								</Alert>
							) : (
								<>
									<TextField
										label={t('dpaSign.signerName', 'Name')}
										value={formState.signerName}
										onChange={(event) =>
											updateField(
												'signerName',
												event.target.value
											)
										}
										required
										fullWidth
									/>
									<TextField
										label={t(
											'dpaSign.signerPosition',
											'Position'
										)}
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
										label={t(
											'dpaSign.signerEmail',
											'E-Mail'
										)}
										type="email"
										value={formState.signerEmail}
										onChange={(event) =>
											updateField(
												'signerEmail',
												event.target.value
											)
										}
										required
										fullWidth
									/>
									{/* The organisation is NOT asked a second time.
									    This link is scoped to exactly one Träger,
									    whose name is shown with the contract and
									    again at the confirmation below, so a
									    retyped name could only contradict the
									    record — and being required, it also
									    stalled signing until someone guessed the
									    exact spelling. The slot carries a free,
									    optional note instead, mirroring the admin
									    panel's shared signer block (owner call
									    2026-07-30, ORISO-Admin#608). It still
									    travels as `signerOrganisation`: that is
									    the append-only signature record's own
									    field, and the write contract leaves it
									    optional. */}
									<TextField
										label={t(
											'dpaSign.signerNote',
											'Anmerkung (optional)'
										)}
										value={formState.signerOrganisation}
										onChange={(event) =>
											updateField(
												'signerOrganisation',
												event.target.value
											)
										}
										fullWidth
									/>
									<TextField
										label={t('dpaSign.language', 'Sprache')}
										value={formState.language}
										onChange={(event) =>
											updateField(
												'language',
												event.target.value
											)
										}
										required
										fullWidth
										select
									>
										<MenuItem value="de">Deutsch</MenuItem>
										<MenuItem value="en">English</MenuItem>
									</TextField>
									{/* Ticking the box IS the signature, so the
									    legal entity it binds must be readable at
									    the act itself — not only in the contract
									    header further up the page. */}
									<Typography
										variant="body2"
										color="text.secondary"
									>
										{t(
											'dpaSign.signingFor',
											'Sie unterzeichnen im Namen von:'
										)}{' '}
										<Box
											component="strong"
											sx={{ color: 'text.primary' }}
										>
											{preview.tenantName}
										</Box>
									</Typography>
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
											'Ich habe die oben angezeigte Vereinbarung gelesen und bestätige sie verbindlich.'
										)}
									/>
									{errorMessage && (
										<Alert severity="error">
											{errorMessage}
										</Alert>
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
											? t(
													'dpaSign.submitting',
													'Speichern...'
												)
											: t(
													'dpaSign.submit',
													'Verbindlich bestätigen'
												)}
									</Button>
								</>
							)}
						</Box>
					</Box>
				)}
			</Paper>
		</Box>
	);
};

const formatDpaDate = (value: string, language: string) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	const locale = language === 'en' ? 'en-GB' : 'de-DE';
	let formatter = DPA_DATE_FORMATTERS.get(locale);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(locale, {
			dateStyle: 'long',
			timeStyle: 'short'
		});
		DPA_DATE_FORMATTERS.set(locale, formatter);
	}

	return formatter.format(date);
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
