import * as React from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { Box, InputBase } from '@mui/material';
import { registrationMd3 } from '../registrationDesign/registrationDesign';

export const ZIPCODE_LENGTH = 5;

export interface ZipcodeDigitsProps {
	value: string;
	onChange: (value: string) => void;
	/** Accessible name template, e.g. "Postleitzahl, Ziffer {{position}} von 5". */
	digitLabel: (position: number) => string;
	autoFocus?: boolean;
}

/**
 * The postcode as five single-character fields: typing advances, backspace on
 * an empty field steps back, and a pasted postcode fills the whole row.
 *
 * German postcodes are always five digits, so the row can be fixed-width and
 * the "how many characters do I still need" question disappears. `inputMode`
 * numeric brings up the number pad — there is deliberately no in-app keypad.
 */
export const ZipcodeDigits = ({
	value,
	onChange,
	digitLabel,
	autoFocus = false
}: ZipcodeDigitsProps) => {
	const refs = useRef<(HTMLInputElement | null)[]>([]);

	const digits = useMemo(
		() =>
			Array.from(
				{ length: ZIPCODE_LENGTH },
				(_unused, index) => value[index] ?? ''
			),
		[value]
	);

	/**
	 * The first slot without a digit. Focus never goes past it, so the row can
	 * never hold a hole — which is what keeps `join('')` faithful: a value of
	 * "12" always means slots 1 and 2, never slots 1 and 4.
	 */
	const firstEmpty = useMemo(() => {
		const found = digits.findIndex((digit) => !digit);
		return found === -1 ? ZIPCODE_LENGTH - 1 : found;
	}, [digits]);

	const focusDigit = useCallback((index: number) => {
		const target = refs.current[index];
		if (target) {
			target.focus();
			target.select();
		}
	}, []);

	const writeAt = useCallback(
		(index: number, raw: string) => {
			const cleaned = raw.replace(/\D/g, '');

			if (!cleaned) {
				const next = digits.slice();
				next[index] = '';
				onChange(next.join('').slice(0, ZIPCODE_LENGTH));
				return;
			}

			// A paste (or a fast typist) can deliver several digits at once:
			// spread them across the remaining fields rather than dropping them.
			const next = digits.slice();
			cleaned
				.slice(0, ZIPCODE_LENGTH - index)
				.split('')
				.forEach((digit, offset) => {
					next[index + offset] = digit;
				});
			onChange(next.join('').slice(0, ZIPCODE_LENGTH));

			const landed = Math.min(index + cleaned.length, ZIPCODE_LENGTH - 1);
			focusDigit(landed);
		},
		[digits, focusDigit, onChange]
	);

	const onKeyDown = useCallback(
		(index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Backspace' && !digits[index] && index > 0) {
				event.preventDefault();
				const next = digits.slice();
				next[index - 1] = '';
				onChange(next.join(''));
				focusDigit(index - 1);
				return;
			}
			if (event.key === 'ArrowLeft' && index > 0) {
				event.preventDefault();
				focusDigit(index - 1);
				return;
			}
			if (event.key === 'ArrowRight' && index < ZIPCODE_LENGTH - 1) {
				event.preventDefault();
				focusDigit(Math.min(index + 1, firstEmpty));
			}
		},
		[digits, firstEmpty, focusDigit, onChange]
	);

	return (
		<Box
			data-cy="zipcode-digits"
			sx={{ display: 'flex', gap: 1, width: '100%' }}
		>
			{digits.map((digit, index) => (
				<InputBase
					key={index}
					inputRef={(node: HTMLInputElement | null) => {
						refs.current[index] = node;
					}}
					value={digit}
					autoFocus={autoFocus && index === 0}
					onChange={(event) => writeAt(index, event.target.value)}
					onKeyDown={onKeyDown(index)}
					onFocus={(event) => {
						// Clicking or tabbing into an empty slot further right
						// used to accept a digit there; `join('')` then moved
						// it to the front and the user submitted a different
						// postcode than the one on screen.
						if (index > firstEmpty) {
							focusDigit(firstEmpty);
							return;
						}
						event.target.select();
					}}
					inputProps={{
						'inputMode': 'numeric',
						'autoComplete': index === 0 ? 'postal-code' : 'off',
						'aria-label': digitLabel(index + 1),
						'data-cy': `zipcode-digit-${index + 1}`,
						'style': { textAlign: 'center', padding: 0 }
					}}
					sx={{
						'flex': 1,
						'minWidth': 0,
						'height': 60,
						'borderRadius': '10px',
						'bgcolor': registrationMd3.surface,
						'border': `2px solid ${
							digit
								? registrationMd3.outline
								: registrationMd3.outlineVariant
						}`,
						'fontSize': 26,
						'fontWeight': 600,
						'fontVariantNumeric': 'tabular-nums',
						'color': registrationMd3.onSurface,
						'transition': 'border-color 140ms ease',
						'&:focus-within': {
							borderColor: registrationMd3.primary
						},
						'@media (prefers-reduced-motion: reduce)': {
							transition: 'none'
						}
					}}
				/>
			))}
		</Box>
	);
};
