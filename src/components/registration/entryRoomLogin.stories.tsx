import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, SvgIcon, Typography } from '@mui/material';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoTextField } from '../form/OrisoTextField';
import { registrationMd3 } from './registrationDesign/registrationDesign';
import { ReactComponent as DoorOpenIcon } from '../../resources/img/icons/navigation/door_open_400.svg';
import { phone375Globals } from '../message/messageStoryShell';

/**
 * The **log-in** side of the entry dialog — ORISO-Frontend#1052, point (d).
 *
 * Frank, 2026-09-04: "wenn ich mich quasi einloggen will, stell dir vor, ich
 * habe irgendwie einen Link gekriegt und bin ja User, dann würde ich mich mit
 * einem Knopf einloggen. Jetzt ist es ja nur ein Registrierending."
 *
 * The registration dialog answers "I am nobody here yet". This one answers the
 * other half: someone who already has an account followed a link and wants to
 * land in *that* conversation, not in their session list. The link therefore has
 * to survive the login — the precedent exists, `gcid` already does it today.
 *
 * Why a dialog and not the login page: sending an existing user to `/login`
 * loses the invitation. A dialog keeps them where the link put them.
 */
const meta: Meta = {
	title: 'Registration/Entry room — log in',
	parameters: {
		docs: {
			description: {
				component:
					'Der Anmelde-Dialog für Menschen, die schon ein Konto haben und über einen Link kommen. Abnahmefläche zu ORISO-Frontend#1052 (d). Nichts davon ist verdrahtet.'
			}
		}
	}
};

export default meta;

const DoorIcon = () => (
	<SvgIcon component={DoorOpenIcon} inheritViewBox sx={{ fontSize: 32 }} />
);

/**
 * Two shapes, one dialog.
 *
 * `withOtp` is not a separate screen: 2FA is a property of the account, and the
 * person cannot know in advance whether theirs has it. The field appears after
 * the first attempt, the way `Login.tsx` already handles it (`isOtpRequired`),
 * rather than asking everyone for a code they may not have.
 */
const LoginDialog = ({
	stage = 'credentials'
}: {
	stage?: 'credentials' | 'otp' | 'error';
}) => {
	const [username, setUsername] = useState('koralle_bela_4111');
	const [password, setPassword] = useState('');
	const [otp, setOtp] = useState('');

	return (
		<Box sx={{ minHeight: '100vh', bgcolor: registrationMd3.surface }}>
			<M3Dialog
				open
				icon={<DoorIcon />}
				title="Einloggen"
				description={
					stage === 'otp'
						? 'Noch der Code aus Ihrer App — dann sind Sie drin.'
						: 'Sie haben schon ein Konto? Dann geht es direkt weiter.'
				}
				onClose={() => undefined}
				closeLabel="Schließen"
				actions={[
					{ label: 'Ohne Konto beitreten', onClick: () => undefined },
					{
						label: 'Einloggen',
						onClick: () => undefined,
						primary: true,
						disabled:
							stage === 'otp'
								? otp.length < 6
								: !username || !password
					}
				]}
			>
				<OrisoTextField
					label="Benutzername"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					fullWidth
					autoComplete="username"
					disabled={stage === 'otp'}
				/>
				<OrisoTextField
					label="Passwort"
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					fullWidth
					autoComplete="current-password"
					disabled={stage === 'otp'}
					sx={{ mt: '12px' }}
					error={stage === 'error'}
					helperText={
						stage === 'error'
							? 'Benutzername oder Passwort stimmt nicht.'
							: undefined
					}
				/>
				{stage === 'otp' && (
					<OrisoTextField
						label="Einmal-Code"
						value={otp}
						onChange={(e) => setOtp(e.target.value)}
						fullWidth
						autoFocus
						inputProps={{
							inputMode: 'numeric',
							autoComplete: 'one-time-code',
							maxLength: 6
						}}
						sx={{ mt: '12px' }}
					/>
				)}
				<Typography
					sx={{
						mt: '12px',
						fontSize: 14,
						color: registrationMd3.onSurfaceVariant
					}}
				>
					Nach dem Einloggen landen Sie direkt in dem Gespräch, zu dem
					Sie eingeladen wurden.
				</Typography>
			</M3Dialog>
		</Box>
	);
};

export const Credentials: StoryObj = {
	name: '1 — Benutzername und Passwort',
	render: () => <LoginDialog />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Normalfall. Zwei Felder, zwei Wege: einloggen, oder doch ohne Konto beitreten. Der Satz unten ist die eigentliche Zusage — der Link geht durch die Anmeldung hindurch verloren, wenn niemand ihn merkt.'
			}
		}
	}
};

export const WithOtp: StoryObj = {
	name: '2 — Zweiter Faktor',
	render: () => <LoginDialog stage="otp" />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Das Code-Feld erscheint erst, wenn das Konto es verlangt — so macht es `Login.tsx` heute schon. Niemand soll nach einem Code gefragt werden, den er gar nicht hat. Die ersten beiden Felder bleiben sichtbar, aber gesperrt: der Mensch soll sehen, dass sein erster Schritt angekommen ist.'
			}
		}
	}
};

export const WrongPassword: StoryObj = {
	name: '3 — Falsches Passwort',
	render: () => <LoginDialog stage="error" />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Fehler steht am Feld, nicht als Wolke über dem Dialog — und er sagt nicht, welches der beiden Felder falsch war. Das ist Absicht.'
			}
		}
	}
};

export const Mobile: StoryObj = {
	name: '4 — Mobil (375 pt)',
	globals: phone375Globals,
	render: () => <LoginDialog />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Auf dem Telefon füllt der Dialog fast das Fenster. Hier entscheidet sich, ob die zwei Aktionen nebeneinander bleiben oder untereinander müssen.'
			}
		}
	}
};
