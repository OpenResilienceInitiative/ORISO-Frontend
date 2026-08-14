import * as React from 'react';
import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import CakeRoundedIcon from '@mui/icons-material/CakeRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { SvgIconComponent } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { IconStepper } from '../../stepper/molecules/IconStepper';
import { CompactStepRow } from '../../stepper/molecules/CompactStepRow';
import { stepperColors } from '../../stepper/stepperDesign';
import {
	RegistrationSelectionChip,
	RegistrationSelectionChips
} from '../selectionChips/RegistrationSelectionChips';

const CANONICAL_STEPS: {
	name: string;
	labelKey: string;
	fallback: string;
	Icon: SvgIconComponent;
}[] = [
	{
		name: 'topic-selection',
		labelKey: 'registration.md3.stepNames.focus',
		fallback: 'Thema wählen',
		Icon: CenterFocusStrongRoundedIcon
	},
	{
		name: 'zipcode',
		labelKey: 'registration.md3.stepNames.postcode',
		fallback: 'Postleitzahl',
		Icon: PlaceRoundedIcon
	},
	{
		name: 'agency-selection',
		labelKey: 'registration.md3.stepNames.agency',
		fallback: 'Beratungsstelle',
		Icon: ApartmentRoundedIcon
	},
	{
		name: 'age',
		labelKey: 'registration.age.headline',
		fallback: 'Alter',
		Icon: CakeRoundedIcon
	},
	{
		name: 'state',
		labelKey: 'registration.state.headline',
		fallback: 'Bundesland',
		Icon: PublicRoundedIcon
	},
	{
		name: 'account-data',
		labelKey: 'registration.md3.stepNames.register',
		fallback: 'Registrieren',
		Icon: HowToRegRoundedIcon
	},
	{
		name: 'request',
		labelKey: 'registration.md3.stepNames.request',
		fallback: 'Anfrage stellen',
		Icon: ChatBubbleRoundedIcon
	}
];

export interface RegistrationHeaderProps {
	currentStepName: string;
	visibleStepNames?: string[];
	clickableStepNames?: string[];
	onStepClick?: (stepName: string) => void;
	/** Picks so far. Rendered in the header on mobile only. */
	chips?: RegistrationSelectionChip[];
	/**
	 * Break out of the page column so the header spans the full viewport, the
	 * way it does on the real registration page. Storybook turns this off, so
	 * the header stays inside its preview frame.
	 */
	fullBleed?: boolean;
	/**
	 * `auto` (default) picks the presentation from the viewport: compact row
	 * below `sm`, icon stepper from `sm` up. `compact` / `stepper` force one,
	 * which is what Storybook and the unit tests need — MUI breakpoints follow
	 * the browser viewport, not the frame a story is rendered into.
	 */
	layout?: 'auto' | 'compact' | 'stepper';
}

/**
 * Sticky registration header.
 *
 * Mobile (`xs`): a 40 pt progress row plus, when something is picked, a 38 pt
 * chip row — 78 pt total against the ~150 pt the icon stepper used to eat out
 * of a 784 pt screen. The chips move up here from the footer, which is why the
 * "AUSGEWÄHLT" bar is gone below.
 *
 * Desktop (`sm` and up): the icon stepper stays — there is room for it and it
 * is the surface the counsellors already know. What changed is the dead space
 * around it and the doubled rule underneath: one divider, default outline tone.
 */
export const RegistrationHeader = ({
	currentStepName,
	visibleStepNames,
	clickableStepNames = [],
	onStepClick,
	chips = [],
	fullBleed = true,
	layout = 'auto'
}: RegistrationHeaderProps) => {
	const { t } = useTranslation();

	const visibleSteps = useMemo(() => {
		if (!visibleStepNames?.length) {
			return CANONICAL_STEPS;
		}

		const wanted = new Set(visibleStepNames);
		return CANONICAL_STEPS.filter(({ name }) => wanted.has(name));
	}, [visibleStepNames]);

	const steps = useMemo(
		() =>
			visibleSteps.map(({ name, labelKey, fallback, Icon }) => ({
				name,
				label: t(labelKey, fallback),
				icon: <Icon />
			})),
		[visibleSteps, t]
	);

	const currentIndex = Math.max(
		steps.findIndex(({ name }) => name === currentStepName),
		0
	);

	const compactDisplay =
		layout === 'compact'
			? 'block'
			: layout === 'stepper'
				? 'none'
				: { xs: 'block', sm: 'none' };
	const stepperDisplay =
		layout === 'stepper'
			? 'block'
			: layout === 'compact'
				? 'none'
				: { xs: 'none', sm: 'block' };

	return (
		<Box
			className="registrationStepperSticky"
			data-cy="registration-header"
			sx={{
				position: fullBleed ? 'sticky' : 'relative',
				top: fullBleed ? { xs: '48px', md: '72px' } : undefined,
				zIndex: 68,
				boxSizing: 'border-box',
				// 100vw counts the classic scrollbar, so pairing it with the
				// negative margin pushed the document sideways by the scrollbar
				// width. The xs row simply fills its column instead.
				width: fullBleed ? { xs: '100%', lg: '60vw' } : '100%',
				ml: fullBleed
					? { xs: 0, lg: 'calc((100% - 60vw) / 2)' }
					: 0,
				px: { xs: 2, sm: 3, lg: 4 },
				backgroundColor: 'rgba(255, 255, 255, 0.96)',
				backdropFilter: 'blur(8px)',
				// One rule, default outline tone. The previous header stacked a
				// border plus a margin band below it, which read as two lines
				// with dead space between them.
				borderBottom: `1px solid ${stepperColors.outline}`,
				pt:
					layout === 'compact'
						? 0
						: layout === 'stepper'
							? 1.5
							: { xs: 0, sm: 1.5 },
				pb:
					layout === 'compact'
						? 0
						: layout === 'stepper'
							? 1.5
							: { xs: 0, sm: 1.5 }
				// No bottom margin: the gap to the step content belongs to the
				// page, not to the header. Carrying it here is what produced
				// the dead band under the desktop stepper.
			}}
		>
			{/* Mobile: compact row + chips */}
			<Box
				sx={{
					display: compactDisplay,
					width: '100%',
					maxWidth: '780px',
					mx: 'auto'
				}}
			>
				<CompactStepRow
					current={currentIndex + 1}
					total={steps.length}
					label={steps[currentIndex]?.label ?? ''}
				/>
				{chips.length > 0 && (
					<Box
						sx={{
							borderTop: `1px solid ${stepperColors.surfaceContainer}`
						}}
					>
						<RegistrationSelectionChips
							chips={chips}
							placement="header"
							selectedPrefix=""
							emptyLabel=""
						/>
					</Box>
				)}
			</Box>

			{/* Desktop: the icon stepper */}
			<Box
				sx={{
					display: stepperDisplay,
					width: '100%',
					maxWidth: '780px',
					mx: 'auto'
				}}
			>
				<Typography
					sx={{
						fontSize: 12,
						fontWeight: 700,
						letterSpacing: 1.2,
						textTransform: 'uppercase',
						color: stepperColors.onSurfaceVariant,
						mb: 0.75
					}}
				>
					{t('registration.headline', 'Registrierung')}
				</Typography>
				<IconStepper
					steps={steps}
					currentStepName={currentStepName}
					clickableStepNames={clickableStepNames}
					onStepClick={onStepClick}
					ariaLabel={t('registration.headline', 'Registrierung')}
				/>
			</Box>
		</Box>
	);
};
