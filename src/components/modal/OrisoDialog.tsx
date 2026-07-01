import * as React from 'react';
import { Box, Button, Dialog, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

export type OrisoDialogProps = {
	open: boolean;
	title: React.ReactNode;
	icon?: React.ReactNode;
	children: React.ReactNode;
	onClose: () => void;
	onBack?: () => void;
	backLabel?: string;
	confirmLabel?: string;
	maxWidth?: string;
	height?: string;
};

export const OrisoDialog = ({
	open,
	title,
	icon,
	children,
	onClose,
	onBack,
	backLabel = 'Zurück',
	confirmLabel = 'Verstanden',
	maxWidth = '554px',
	height = '680px'
}: OrisoDialogProps) => (
	<Dialog
		open={open}
		onClose={onClose}
		fullWidth
		maxWidth={false}
		BackdropProps={{
			sx: {
				backgroundColor: 'rgba(255, 255, 255, 0.8)',
				backdropFilter: 'blur(2px)'
			}
		}}
		PaperProps={{
			sx: {
				width: { xs: 'calc(100vw - 34px)', sm: maxWidth },
				maxWidth,
				height: { xs: 'min(680px, calc(100vh - 64px))', sm: height },
				m: { xs: '17px', sm: '32px' },
				borderRadius: '24px',
				border: '1px solid #D9D9D9',
				boxShadow:
					'0 16px 16px rgba(12, 12, 13, 0.1), 0 4px 2px rgba(12, 12, 13, 0.05)',
				overflow: 'hidden'
			}
		}}
	>
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				gap: '16px',
				height: '100%',
				p: '32px 16px',
				boxSizing: 'border-box',
				position: 'relative'
			}}
		>
			<IconButton
				aria-label="Schliessen"
				onClick={onClose}
				sx={{
					position: 'absolute',
					top: 10,
					right: 10,
					display: { xs: 'none', sm: 'inline-flex' },
					color: '#4C555F'
				}}
			>
				<CloseIcon />
			</IconButton>

			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: '12px',
					width: '100%'
				}}
			>
				{icon && (
					<Box
						sx={{
							'width': 100,
							'height': 100,
							'flexShrink': 0,
							'display': 'flex',
							'alignItems': 'center',
							'justifyContent': 'center',
							'color': '#1B1B1C',
							'& svg': {
								fontSize: 88
							}
						}}
						aria-hidden="true"
					>
						{icon}
					</Box>
				)}
				<Typography
					variant="h4"
					sx={{
						flex: 1,
						minWidth: 0,
						color: '#1B1B1C',
						fontSize: '24px',
						fontWeight: 700,
						lineHeight: 1.2
					}}
				>
					{title}
				</Typography>
			</Box>

			<Box
				sx={{
					'flex': 1,
					'minHeight': 0,
					'overflowY': 'auto',
					'pr': '8px',
					'color': '#1E1E1E',
					'fontSize': '16px',
					'lineHeight': 1.4,
					'scrollbarWidth': 'thin',
					'scrollbarColor': '#D9D9D9 transparent',
					'&::-webkit-scrollbar': {
						width: '4px'
					},
					'&::-webkit-scrollbar-thumb': {
						backgroundColor: '#D9D9D9',
						borderRadius: '4px'
					}
				}}
			>
				{children}
			</Box>

			<Box sx={{ display: 'flex', gap: '8px', width: '100%' }}>
				<Button
					fullWidth
					variant="outlined"
					onClick={onBack || onClose}
					startIcon={<ArrowBackIcon />}
					sx={{
						'borderRadius': '24px',
						'borderColor': 'transparent',
						'backgroundColor': '#F0EDEE',
						'color': '#4C555F',
						'textTransform': 'none',
						'fontSize': '14px',
						'fontWeight': 500,
						'lineHeight': '20px',
						'py': '10px',
						'&:hover': {
							borderColor: 'transparent',
							backgroundColor: '#E5E1E2'
						}
					}}
				>
					{backLabel}
				</Button>
				<Button
					fullWidth
					variant="contained"
					onClick={onClose}
					startIcon={<CheckIcon />}
					sx={{
						'borderRadius': '8px',
						'backgroundColor': '#4C555F',
						'color': '#FFFFFF',
						'textTransform': 'none',
						'fontSize': '14px',
						'fontWeight': 500,
						'lineHeight': '20px',
						'py': '10px',
						'boxShadow': 'none',
						'&:hover': {
							backgroundColor: '#3F4851',
							boxShadow: 'none'
						}
					}}
				>
					{confirmLabel}
				</Button>
			</Box>
		</Box>
	</Dialog>
);
