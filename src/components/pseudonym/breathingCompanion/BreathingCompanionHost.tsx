import * as React from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { translateWithFallback } from '../../../utils/translationFallback';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import BreathingCompanion, {
	BREATHING_COPY,
	BreathingCopy
} from './BreathingCompanion';

export interface BreathingCompanionHostProps {
	onClose: () => void;
	reducedMotion?: boolean;
}

/**
 * Walk the German copy constants and replace every leaf with its translation
 * under `liveChat.breathing.*`, falling back to the constant. Arrays keep
 * their order and length, so the four phases stay four in every language.
 */
const translateCopy = (
	t: (key: string, options?: Record<string, unknown>) => unknown,
	node: unknown,
	path: string
): unknown => {
	if (Array.isArray(node)) {
		return node.map((item, index) =>
			translateCopy(t, item, `${path}.${index}`)
		);
	}
	if (node && typeof node === 'object') {
		return Object.fromEntries(
			Object.entries(node as Record<string, unknown>).map(
				([key, value]) => [
					key,
					translateCopy(t, value, `${path}.${key}`)
				]
			)
		);
	}
	return translateWithFallback(t, path, String(node));
};

/**
 * The breathing companion inside ORISO. The game itself is a single-file
 * handoff (`BreathingCompanion.tsx`, integration contract at its top) and
 * stays as delivered apart from taking its copy as a prop. This host does
 * what the contract asks of the application:
 *
 * - a resolved height: `flex: 1; min-height: 0`, never below 300 px;
 * - the three design tokens mapped to the M3 variables the app already has;
 * - copy from i18n (`liveChat.breathing.*`: de formal, de@informal; the
 *   German constants as fallback for every other language until translated);
 * - font inherited from the app, surface from the surrounding column.
 *
 * Unmounting is the caller's job — the waiting room unmounts it the moment a
 * counsellor accepts (the contract: "When counselling starts, UNMOUNT").
 */
export const BreathingCompanionHost = ({
	onClose,
	reducedMotion
}: BreathingCompanionHostProps) => {
	const { t } = useTranslation();
	const copy = React.useMemo(
		() =>
			translateCopy(
				t,
				BREATHING_COPY,
				'liveChat.breathing'
			) as BreathingCopy,
		[t]
	);
	return (
		<Box
			data-cy="breathing-companion"
			sx={{
				'flex': 1,
				'minHeight': 300,
				'minWidth': 0,
				'display': 'flex',
				'flexDirection': 'column',
				/* The game's root is `height: 100%`, which a flex item cannot
				   resolve against a flexed parent (measured: 108 px of 589).
				   As a column child with `flex: 1` it takes the whole box. */
				'& > .bc-root': { flex: 1, minHeight: 0, height: 'auto' },
				'--breathing-accent': registrationMd3.primary,
				'--breathing-text': registrationMd3.onSurface,
				'--breathing-muted': registrationMd3.onSurfaceVariant
			}}
		>
			<BreathingCompanion
				onClose={onClose}
				reducedMotion={reducedMotion}
				copy={copy}
			/>
		</Box>
	);
};
