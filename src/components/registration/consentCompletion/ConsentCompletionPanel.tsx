import * as React from 'react';
import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
	registrationMd3,
	registrationMotion
} from '../registrationDesign/registrationDesign';

/** Presentation only: the owner keeps the legal wording and its acceptance binding. */
export const ConsentCompletionPanel = ({
	visible = true,
	ariaLabel,
	status,
	label,
	checked,
	disabled = false,
	onChange,
	inputRef,
	error,
	errorId
}: {
	visible?: boolean;
	ariaLabel: string;
	/** Only flows with a real readiness status add a header above consent. */
	status?: {
		heading: string;
		subtitle?: string;
		icon: React.ReactNode;
		/** A quiet exit leaves the final action its entire row. */
		trailingAction?: React.ReactNode;
	};
	label: React.ReactNode;
	checked: boolean;
	disabled?: boolean;
	onChange: () => void;
	inputRef?: React.Ref<HTMLInputElement>;
	error?: string;
	errorId?: string;
}) => (
	<Box
		role="region"
		aria-label={ariaLabel}
		hidden={!visible}
		data-cy="consent-completion"
		sx={{
			'width': '100%',
			'minWidth': 0,
			'display': visible ? 'grid' : 'none',
			'gridTemplateRows': '1fr',
			'animation': visible
				? `consentCompletionReveal ${registrationMotion.slow} ${registrationMotion.easeOut} both`
				: 'none',
			'@keyframes consentCompletionReveal': {
				from: { gridTemplateRows: '0fr', opacity: 0 },
				to: { gridTemplateRows: '1fr', opacity: 1 }
			},
			'@media (prefers-reduced-motion: reduce)': { animation: 'none' }
		}}
	>
		{/* The clip owns no padding, so the opening can start at zero height. */}
		<Box sx={{ minHeight: 0, overflow: 'hidden' }}>
			<Box
				sx={{
					'py': { xs: 1, sm: 1.5 },
					'animation': visible
						? `consentCompletionRise ${registrationMotion.slow} ${registrationMotion.easeOut} both`
						: 'none',
					'@keyframes consentCompletionRise': {
						from: { transform: 'translateY(100%)' },
						to: { transform: 'translateY(0)' }
					},
					'@media (prefers-reduced-motion: reduce)': {
						animation: 'none'
					}
				}}
			>
				{status && (
					<Box
						sx={{
							display: 'grid',
							gridTemplateColumns: '36px minmax(0, 1fr) auto',
							columnGap: 1.5,
							mb: 1.5
						}}
					>
						<Box
							aria-hidden
							sx={{
								'gridColumn': 1,
								'gridRow': 1,
								'alignSelf': 'center',
								'display': 'flex',
								'width': 36,
								'height': 36,
								'color': registrationMd3.primary,
								'& svg': { fontSize: 36 }
							}}
						>
							{status.icon}
						</Box>
						<Typography
							component="h2"
							sx={{
								gridColumn: 2,
								gridRow: 1,
								alignSelf: 'center',
								minWidth: 0,
								fontSize: 22,
								fontWeight: 700
							}}
						>
							{status.heading}
						</Typography>
						{status.subtitle && (
							<Typography
								sx={{
									gridColumn: 2,
									gridRow: 2,
									minWidth: 0,
									fontSize: 15,
									color: registrationMd3.onSurfaceVariant
								}}
							>
								{status.subtitle}
							</Typography>
						)}
						{status.trailingAction && (
							<Box sx={{ gridColumn: 3, gridRow: '1 / span 2' }}>
								{status.trailingAction}
							</Box>
						)}
					</Box>
				)}
				{/* A status uses the same 36px leading column for its icon and checkbox,
				    keeping both text edges aligned. Plain consent needs only the checkbox. */}
				<Box
					sx={{ maxHeight: '35dvh', overflowY: 'auto', minWidth: 0 }}
				>
					<FormControlLabel
						sx={{
							'm': 0,
							'width': '100%',
							'alignItems': 'flex-start',
							'& .MuiFormControlLabel-label': {
								minWidth: 0,
								flex: 1
							}
						}}
						control={
							<Checkbox
								inputRef={inputRef}
								checked={checked}
								disabled={disabled}
								onChange={onChange}
								inputProps={{
									'aria-invalid': Boolean(error),
									'aria-describedby': error
										? errorId
										: undefined
								}}
								sx={{
									p: 0,
									width: status ? 36 : 24,
									flexShrink: 0,
									mr: 1.5,
									color: error
										? registrationMd3.error
										: undefined
								}}
							/>
						}
						label={label}
					/>
					{error && (
						<Box
							id={errorId}
							role="alert"
							sx={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: 1,
								mt: 1,
								color: registrationMd3.error
							}}
						>
							<ErrorOutlineIcon
								sx={{ fontSize: 20, flexShrink: 0 }}
							/>
							<Typography
								sx={{
									fontSize: 14,
									fontWeight: 600,
									color: 'inherit'
								}}
							>
								{error}
							</Typography>
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	</Box>
);
