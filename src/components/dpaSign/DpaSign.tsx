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
import type { TFunction } from 'i18next';
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
	const { i18n } = useTranslation();
	const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
	/*
	 * The page chrome follows the "Sprache" select, not the app-wide locale.
	 *
	 * This is a public one-shot page: the global i18n language comes from the
	 * browser's navigator order — or from a `locale` this browser persisted in
	 * an earlier app session — and a signer has no profile switcher here to
	 * correct it. Seen on pre-dev: chrome entirely in Russian while the select
	 * said "Deutsch". Binding the chrome to the selected signature language
	 * keeps every visible word in the same language as the contract being
	 * signed, starting in German like the select itself. `getFixedT` scopes
	 * this to the page — the app-wide language is left untouched.
	 */
	const [chromeLanguage, setChromeLanguage] = useState(
		INITIAL_FORM_STATE.language
	);
	useEffect(() => {
		let active = true;
		// The `.then` runs only on a resolved load, so a rejected
		// `loadLanguages` leaves `chromeLanguage` exactly where it was —
		// applying the new language here regardless of the outcome would
		// point the page chrome at a locale i18next never finished loading.
		i18n.loadLanguages(formState.language)
			.then(() => {
				if (active) {
					setChromeLanguage(formState.language);
				}
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [formState.language, i18n]);
	const t = useMemo(
		() => i18n.getFixedT(chromeLanguage),
		[i18n, chromeLanguage]
	);
	const [submitState, setSubmitState] = useState<SubmitState>('idle');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [preview, setPreview] = useState<DpaSignPreviewResponse | null>(null);
	const [previewLoading, setPreviewLoading] = useState(true);
	// The preview fetch is keyed to the token in the URL, not to the
	// currently selected chrome language — storing only the *kind* of
	// failure here (never a translated string) lets the effect below skip
	// `t` in its dependency list, so switching the "Sprache" select can no
	// longer re-trigger a network refetch of a contract that already
	// loaded. The kind is translated into the visible message separately,
	// further down, so it still tracks a later language change.
	const [previewErrorKind, setPreviewErrorKind] =
		useState<PreviewErrorKind | null>(null);

	const decodedToken = useMemo(
		() => (token ? decodeURIComponent(token) : ''),
		[token]
	);

	useEffect(() => {
		let active = true;
		setPreview(null);
		setPreviewLoading(true);
		setPreviewErrorKind(null);

		if (!decodedToken) {
			setPreviewLoading(false);
			setPreviewErrorKind('missingToken');
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
					setPreviewErrorKind(resolveErrorKind(error));
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
	}, [decodedToken]);
	const previewErrorMessage = useMemo(
		() =>
			previewErrorKind ? translateErrorKind(previewErrorKind, t) : null,
		[previewErrorKind, t]
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

		if (!decodedToken || !preview) {
			setSubmitState('error');
			setErrorMessage(
				t(
					'dpaSign.error.previewRequired',
					'Die Vertragsunterlagen müssen vollständig geladen sein, bevor Sie sie bestätigen können.'
				)
			);
			return;
		}

		if (!formState.accepted) {
			setSubmitState('error');
			setErrorMessage(
				t(
					'dpaSign.error.acceptRequired',
					'Bitte bestätigen Sie die Vertragsunterlagen.'
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
			lang={chromeLanguage}
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
						{t('dpaSign.title', 'Vertragsunterlagen unterzeichnen')}
					</Typography>
					<Typography color="text.secondary">
						{t(
							'dpaSign.subtitle',
							'Bitte lesen Sie die Vertragsunterlagen vollständig und bestätigen Sie anschließend die Angaben zur unterzeichnenden Person.'
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
								'Vertragsunterlagen werden geladen...'
							)}
						</Typography>
					</Box>
				) : !preview ? (
					<Alert severity="error">
						{previewErrorMessage ??
							t(
								'dpaSign.error.generic',
								'Die Vertragsunterlagen konnten gerade nicht geladen werden.'
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
									'Vertragsunterlagen'
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
										'Die Bestätigung der Vertragsunterlagen wurde gespeichert.'
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
											'Ich habe die oben angezeigten Vertragsunterlagen gelesen und bestätige sie verbindlich.'
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

// A `PreviewErrorKind` names *why* the preview failed without committing to
// any language — translating it is a pure function of the kind and the
// current `t`, so it can be re-run whenever `t` changes (a language switch)
// without needing to repeat whatever produced the kind in the first place
// (a network fetch).
type PreviewErrorKind =
	| 'missingToken'
	| typeof DPA_SIGN_ERRORS.INVALID_OR_EXPIRED_TOKEN
	| typeof DPA_SIGN_ERRORS.INVALID_REQUEST
	| 'generic';

const resolveErrorKind = (error: unknown): PreviewErrorKind => {
	if (
		error instanceof Error &&
		error.message === DPA_SIGN_ERRORS.INVALID_OR_EXPIRED_TOKEN
	) {
		return DPA_SIGN_ERRORS.INVALID_OR_EXPIRED_TOKEN;
	}

	if (
		error instanceof Error &&
		error.message === DPA_SIGN_ERRORS.INVALID_REQUEST
	) {
		return DPA_SIGN_ERRORS.INVALID_REQUEST;
	}

	return 'generic';
};

const translateErrorKind = (kind: PreviewErrorKind, t: TFunction) => {
	switch (kind) {
		case 'missingToken':
			return t(
				'dpaSign.error.missingToken',
				'Der Signaturlink ist unvollständig.'
			);
		case DPA_SIGN_ERRORS.INVALID_OR_EXPIRED_TOKEN:
			return t(
				'dpaSign.error.invalidToken',
				'Dieser Signaturlink ist ungültig, abgelaufen oder wurde bereits verwendet.'
			);
		case DPA_SIGN_ERRORS.INVALID_REQUEST:
			return t(
				'dpaSign.error.invalidRequest',
				'Die Angaben konnten nicht gespeichert werden. Bitte prüfen Sie das Formular.'
			);
		default:
			return t(
				'dpaSign.error.generic',
				'Die Signatur konnte gerade nicht gespeichert werden.'
			);
	}
};

const resolveErrorMessage = (error: unknown, t: TFunction) =>
	translateErrorKind(resolveErrorKind(error), t);
