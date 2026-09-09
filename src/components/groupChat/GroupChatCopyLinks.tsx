import React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import QRCode from 'qrcode';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_SUCCESS
} from '../../globalState';
import { CopyIcon } from '../../resources/img/icons';
import { copyTextToClipboard } from '../../utils/clipboardHelpers';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { buildGroupChatInviteLink } from './groupChatInviteLink';

type GroupChatCopyLinksProps = {
	seriesId: number;
};

export const GroupChatCopyLinks = ({ seriesId }: GroupChatCopyLinksProps) => {
	const settings = useAppConfig();
	const url = buildGroupChatInviteLink(settings.urls.toLogin, seriesId);
	const { addNotification } = useContext(NotificationsContext);
	const { t: translate } = useTranslation();

	const [qr, setQr] = useState('');
	useEffect(() => {
		let active = true;
		setQr('');
		QRCode.toDataURL(url, {
			errorCorrectionLevel: 'L',
			width: 360,
			color: { dark: '#000000', light: '#ffffff' }
		})
			.then((value) => {
				if (active) setQr(value);
			})
			.catch(() => {
				/* The invitation URL remains available if QR generation fails. */
			});
		return () => {
			active = false;
		};
	}, [url]);
	const copyRegistrationLink = useCallback(async () => {
		await copyTextToClipboard(url, () => {
			addNotification({
				notificationType: NOTIFICATION_TYPE_SUCCESS,
				title: translate('groupChat.copy.link.notification.title'),
				text: translate('groupChat.copy.link.notification.text')
			});
		});
	}, [url, addNotification, translate]);
	return (
		<Box sx={{ display: 'grid', gap: 2 }}>
			<TextField
				fullWidth
				size="small"
				label={translate('groupChat.copy.link.title')}
				value={url}
				InputProps={{ readOnly: true }}
			/>
			<Button
				variant="outlined"
				startIcon={<CopyIcon />}
				onClick={copyRegistrationLink}
				sx={{
					justifySelf: 'start',
					textTransform: 'none',
					minHeight: 44,
					whiteSpace: 'normal'
				}}
			>
				{translate('groupChat.copy.link.text')}
			</Button>
			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: 2,
					alignItems: 'center'
				}}
			>
				{qr && (
					<Box
						component="img"
						src={qr}
						alt={translate('qrCode.overlay.image.alt')}
						sx={{
							width: 160,
							height: 160,
							borderRadius: 2,
							flexShrink: 0
						}}
					/>
				)}
				<Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
					<Typography component="h3" variant="subtitle1">
						{translate('groupChat.qrCode.headline')}
					</Typography>
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ mb: 1 }}
					>
						{translate('groupChat.qrCode.text')}
					</Typography>
					{qr && (
						<Button
							component="a"
							sx={{
								textTransform: 'none',
								minHeight: 44,
								whiteSpace: 'normal'
							}}
							href={qr}
							download={
								translate('qrCode.download.filename', {
									filename: `group-chat-${seriesId}`
								}) + '.png'
							}
							size="small"
						>
							{translate('qrCode.overlay.download')}
						</Button>
					)}
				</Box>
			</Box>
		</Box>
	);
};
