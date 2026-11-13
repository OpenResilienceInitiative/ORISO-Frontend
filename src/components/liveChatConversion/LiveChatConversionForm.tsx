import * as React from 'react';
import { useState } from 'react';
import {
	Alert,
	Box,
	Button,
	Stack,
	TextField,
	Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface LiveChatConversionFormProps {
	loginName: string;
	busy: boolean;
	error?: string | null;
	onSubmit: (password: string) => void;
}

/** Collects durable credentials after the shared recovery-key confirmation step. */
export const LiveChatConversionForm = ({
	loginName,
	busy,
	error,
	onSubmit
}: LiveChatConversionFormProps) => {
	const { t } = useTranslation();
	const [password, setPassword] = useState('');
	const [repeat, setRepeat] = useState('');
	const tr = (key: string, fallback: string) =>
		t(`liveChatConversion.${key}`, fallback);
	const valid =
		loginName.length > 0 && password.length >= 16 && password === repeat;
	return (
		<Box
			component="form"
			onSubmit={(event) => {
				event.preventDefault();
				if (valid && !busy) onSubmit(password);
			}}
			sx={{ maxWidth: 560, mx: 'auto', p: 3 }}
		>
			<Stack spacing={2}>
				<Typography component="h1" variant="h4">
					{tr('title', 'Keep your conversation')}
				</Typography>
				<Typography>
					{tr(
						'intro',
						'Create a password for this account. Your Live Chat stays with you.'
					)}
				</Typography>
				<Typography>
					{tr('loginName', 'Your login name:')}{' '}
					<strong>{loginName}</strong>
				</Typography>
				<TextField
					type="password"
					autoComplete="new-password"
					label={tr('password', 'Password')}
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					helperText={tr('passwordHelp', 'At least 16 characters')}
				/>
				<TextField
					type="password"
					autoComplete="new-password"
					label={tr('repeat', 'Repeat password')}
					value={repeat}
					onChange={(event) => setRepeat(event.target.value)}
				/>
				{error && (
					<Alert severity="error" role="alert">
						{error}
					</Alert>
				)}
				<Button
					variant="contained"
					type="submit"
					disabled={!valid || busy}
				>
					{tr('submit', 'Create my account')}
				</Button>
			</Stack>
		</Box>
	);
};
