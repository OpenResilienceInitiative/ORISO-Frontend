import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Typography
} from '@mui/material';
import * as React from 'react';
import { FormEvent, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
	acceptAccountInvite,
	AccountInviteDetails,
	getAccountInvite
} from '../../api/apiAccountInvite';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { OrisoTextField } from '../form/OrisoTextField';
import { allPasswordCriteriaPass } from '../registration/accountData/passwordRules';
import { StageLayout } from '../stageLayout/StageLayout';
import '../login/login.styles';

export const AccountInviteAcceptance = () => {
	const { token } = useParams<{ token: string }>();
	const { t } = useTranslation();
	const { Stage } = useContext(GlobalComponentContext);
	const [invite, setInvite] = useState<AccountInviteDetails | null>(null);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [repeatedPassword, setRepeatedPassword] = useState('');
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [completed, setCompleted] = useState(false);

	useEffect(() => {
		let active = true;
		if (!token) {
			setError(
				t('accountInvite.invalid', 'Der Einladungslink ist ungültig.')
			);
			setLoading(false);
			return () => {
				active = false;
			};
		}

		getAccountInvite(token)
			.then((details) => {
				if (active) setInvite(details);
			})
			.catch(() => {
				if (active) {
					setError(
						t(
							'accountInvite.invalid',
							'Der Einladungslink ist ungültig oder abgelaufen.'
						)
					);
				}
			})
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [t, token]);

	const valid =
		username.trim().length > 0 &&
		allPasswordCriteriaPass(password) &&
		password === repeatedPassword;

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!token || !valid || submitting) return;

		setSubmitting(true);
		setError('');
		try {
			const result = await acceptAccountInvite(token, {
				username: username.trim(),
				password,
				formalLanguage: true
			});
			if (result.provisioningStatus !== 'COMPLETED') {
				throw new Error('Account provisioning did not complete');
			}
			setCompleted(true);
		} catch (_error) {
			setError(
				t(
					'accountInvite.createFailed',
					'Das Beratungskonto konnte nicht erstellt werden. Bitte versuchen Sie es erneut.'
				)
			);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<StageLayout stage={<Stage />} showLegalLinks>
			<Box className="loginForm" data-testid="account-invite-acceptance">
				<Box className="loginForm__inner">
					{loading ? (
						<CircularProgress
							aria-label={t(
								'accountInvite.loading',
								'Einladung wird geladen'
							)}
						/>
					) : completed ? (
						<Box>
							<Typography
								component="h1"
								variant="h4"
								gutterBottom
							>
								{t(
									'accountInvite.successTitle',
									'Konto erstellt'
								)}
							</Typography>
							<Typography paragraph>
								{t(
									'accountInvite.success',
									'Ihr Beratungskonto wurde erstellt.'
								)}
							</Typography>
							<Button
								component={Link}
								to="/login"
								variant="contained"
							>
								{t('accountInvite.toLogin', 'Zur Anmeldung')}
							</Button>
						</Box>
					) : (
						<Box component="form" onSubmit={submit} noValidate>
							<Typography
								component="h1"
								variant="h4"
								gutterBottom
							>
								{t(
									'accountInvite.title',
									'Beratungskonto erstellen'
								)}
							</Typography>
							<Typography paragraph>
								{t(
									'accountInvite.description',
									'Vervollständigen Sie Ihre Einladung mit einem Benutzernamen und Passwort.'
								)}
							</Typography>
							{error && <Alert severity="error">{error}</Alert>}
							{invite && (
								<>
									<OrisoTextField
										label={t(
											'accountInvite.email',
											'E-Mail-Adresse'
										)}
										value={invite.recipientEmail}
										disabled
										fullWidth
										margin="normal"
									/>
									<OrisoTextField
										label={t(
											'accountInvite.username',
											'Benutzername'
										)}
										value={username}
										onChange={(event) =>
											setUsername(event.target.value)
										}
										autoComplete="username"
										fullWidth
										margin="normal"
									/>
									<OrisoTextField
										label={t(
											'accountInvite.password',
											'Passwort'
										)}
										type="password"
										value={password}
										onChange={(event) =>
											setPassword(event.target.value)
										}
										autoComplete="new-password"
										fullWidth
										margin="normal"
										helperText={t(
											'accountInvite.passwordHint',
											'Mindestens 16 Zeichen mit Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.'
										)}
									/>
									<OrisoTextField
										label={t(
											'accountInvite.repeatPassword',
											'Passwort wiederholen'
										)}
										type="password"
										value={repeatedPassword}
										onChange={(event) =>
											setRepeatedPassword(
												event.target.value
											)
										}
										autoComplete="new-password"
										fullWidth
										margin="normal"
									/>
									<Button
										type="submit"
										variant="contained"
										disabled={!valid || submitting}
										sx={{ mt: 2 }}
									>
										{t(
											'accountInvite.submit',
											'Konto erstellen'
										)}
									</Button>
								</>
							)}
						</Box>
					)}
				</Box>
			</Box>
		</StageLayout>
	);
};
