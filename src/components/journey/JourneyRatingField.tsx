import * as React from 'react';
import { useId, useState } from 'react';
import { Box, Slider, Typography } from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import { useTranslation } from 'react-i18next';
import { orisoInputColors } from '../form/orisoInputDesign';
import { textIn, type JourneyRating } from './journeyModel';

export interface JourneyRatingFieldProps {
	rating: JourneyRating;
	value?: number;
	language: string;
	onChange: (value: number) => void;
	showMissing?: boolean;
	disabled?: boolean;
}

const Label = ({
	id,
	rating,
	language
}: {
	id: string;
	rating: JourneyRating;
	language: string;
}) => {
	const { t } = useTranslation();
	return (
		<Typography
			id={id}
			component="span"
			sx={{
				display: 'block',
				mb: 1.5,
				fontSize: 18,
				fontWeight: 600,
				lineHeight: '26px',
				color: orisoInputColors.onSurface
			}}
		>
			{textIn(rating.label, language)}
			{!rating.required && (
				<Typography
					component="span"
					sx={{
						ml: 1,
						fontSize: 14,
						fontWeight: 400,
						color: orisoInputColors.onSurfaceVariant
					}}
				>
					{t('journey.question.optional')}
				</Typography>
			)}
		</Typography>
	);
};

/**
 * Stars: five real radio buttons drawn as stars. Hovering previews, the arrow keys move as in any
 * radio group, and the chosen count is spoken ("3 von 5 Sternen").
 */
const Stars = ({
	rating,
	value,
	onChange,
	disabled,
	labelId,
	name
}: {
	rating: JourneyRating;
	value?: number;
	onChange: (value: number) => void;
	disabled?: boolean;
	labelId: string;
	name: string;
}) => {
	const { t } = useTranslation();
	const [hover, setHover] = useState<number>();
	const shown = hover ?? value ?? 0;
	return (
		<Box
			role="radiogroup"
			aria-labelledby={labelId}
			sx={{ display: 'flex', gap: 0.5 }}
			onMouseLeave={() => setHover(undefined)}
		>
			{Array.from(
				{ length: rating.max - rating.min + 1 },
				(_unused, index) => rating.min + index
			).map((star) => (
				<Box
					key={star}
					component="label"
					onMouseEnter={() => !disabled && setHover(star)}
					sx={{
						'position': 'relative',
						'display': 'grid',
						'placeItems': 'center',
						'width': 48,
						'height': 48,
						'borderRadius': '50%',
						'cursor': disabled ? 'default' : 'pointer',
						'color':
							star <= shown
								? orisoInputColors.primary
								: orisoInputColors.outline,
						'&:has(input:focus-visible)': {
							outline: `3px solid ${orisoInputColors.focus}`
						}
					}}
				>
					<input
						type="radio"
						name={name}
						value={star}
						checked={value === star}
						disabled={disabled}
						onChange={() => onChange(star)}
						aria-label={t('journey.rating.stars', {
							count: star,
							max: rating.max
						})}
						style={{
							position: 'absolute',
							opacity: 0,
							width: 1,
							height: 1,
							margin: 0
						}}
					/>
					{star <= shown ? (
						<StarRoundedIcon sx={{ fontSize: 36 }} />
					) : (
						<StarOutlineRoundedIcon sx={{ fontSize: 36 }} />
					)}
				</Box>
			))}
		</Box>
	);
};

/**
 * A range such as −5 … +5: a slider with the editor's words at both ends and in the middle. It
 * starts untouched — a value only counts once the person moved it — so nobody "answers" 0 by
 * scrolling past.
 */
const Range = ({
	rating,
	value,
	onChange,
	disabled,
	labelId,
	language
}: {
	rating: JourneyRating;
	value?: number;
	onChange: (value: number) => void;
	disabled?: boolean;
	labelId: string;
	language: string;
}) => {
	const { t } = useTranslation();
	const middle = Math.round((rating.min + rating.max) / 2);
	const untouched = value === undefined;
	// The words sit in their own row under the track: as slider mark labels they were centred on
	// the ends and broke letter by letter on a phone.
	const ends = [
		textIn(rating.minLabel, language) || String(rating.min),
		textIn(rating.midLabel, language),
		textIn(rating.maxLabel, language) || String(rating.max)
	];
	const marks = [
		rating.min,
		...(rating.midLabel ? [middle] : []),
		rating.max
	].map((mark) => ({ value: mark }));
	return (
		<Box sx={{ px: 1.5 }}>
			<Slider
				min={rating.min}
				max={rating.max}
				step={1}
				marks={marks}
				disabled={disabled}
				value={value ?? middle}
				onChange={(_event, next) => onChange(next as number)}
				valueLabelDisplay={untouched ? 'off' : 'on'}
				getAriaValueText={(current) => {
					if (untouched) return t('journey.rating.untouched');
					// The words under the track are hidden from screen readers; the value says them.
					const word =
						current === rating.min
							? ends[0]
							: current === rating.max
								? ends[2]
								: current === middle
									? ends[1]
									: '';
					return word ? `${current} (${word})` : String(current);
				}}
				slotProps={{ input: { 'aria-labelledby': labelId } }}
				sx={{
					'color': orisoInputColors.primary,
					'mt': 1,
					'& .MuiSlider-thumb': untouched
						? {
								backgroundColor: orisoInputColors.surface,
								border: `2px solid ${orisoInputColors.outline}`
							}
						: {},
					'& .MuiSlider-track': untouched ? { opacity: 0 } : {}
				}}
			/>
			<Box
				aria-hidden
				sx={{
					display: 'grid',
					gridTemplateColumns: '1fr 1fr 1fr',
					gap: 1,
					mt: -0.5,
					fontSize: 13,
					lineHeight: '18px',
					color: orisoInputColors.onSurfaceVariant
				}}
			>
				<Box sx={{ textAlign: 'left' }}>{ends[0]}</Box>
				<Box sx={{ textAlign: 'center' }}>{ends[1]}</Box>
				<Box sx={{ textAlign: 'right' }}>{ends[2]}</Box>
			</Box>
			{untouched && (
				<Typography
					sx={{
						mt: 1.5,
						fontSize: 14,
						color: orisoInputColors.onSurfaceVariant
					}}
				>
					{t('journey.rating.moveHint')}
				</Typography>
			)}
		</Box>
	);
};

/** One rating of a journey step: stars or a range (ORISO-Frontend#2333). */
export const JourneyRatingField = ({
	rating,
	value,
	language,
	onChange,
	showMissing = false,
	disabled = false
}: JourneyRatingFieldProps) => {
	const { t } = useTranslation();
	const labelId = useId();
	const name = useId();
	return (
		<Box data-cy="journey-rating" data-rating-type={rating.type}>
			<Label id={labelId} rating={rating} language={language} />
			{rating.type === 'stars' ? (
				<Stars
					rating={rating}
					value={value}
					onChange={onChange}
					disabled={disabled}
					labelId={labelId}
					name={name}
				/>
			) : (
				<Range
					rating={rating}
					value={value}
					onChange={onChange}
					disabled={disabled}
					labelId={labelId}
					language={language}
				/>
			)}
			{showMissing && value === undefined && (
				<Typography
					role="alert"
					sx={{ mt: 1, fontSize: 14, color: orisoInputColors.error }}
				>
					{t('journey.question.missing')}
				</Typography>
			)}
		</Box>
	);
};
