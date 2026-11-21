import * as React from 'react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Button as MuiButton,
	FormControlLabel,
	IconButton,
	Radio,
	RadioGroup
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import clsx from 'clsx';
import { useResponsive } from '../../hooks/useResponsive';
import CheckIcon from '@mui/icons-material/Check';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { Button, BUTTON_TYPES } from '../../components/button/Button';
import { M3Dialog } from '../../components/m3Dialog/M3Dialog';
import {
	CONTRAST_OPTIONS,
	DisplayPreferences,
	getNextTextSize,
	SchemePreference,
	TextSize
} from './preferences';
import { Headline } from '../../components/headline/Headline';
import { usePersonalDisplay } from './PersonalDisplayProvider';
import './personalDisplay.scss';
import '../../components/app/mobileNavigation.scss';

const schemes: SchemePreference[] = ['system', 'light', 'dark'];

type DisplayPlacement = 'navigation' | 'conversation';

export const PersonalDisplayEntry = ({
	placement = 'navigation'
}: {
	placement?: DisplayPlacement;
}) => {
	const { showAskerEntry, preferences, update } = usePersonalDisplay();
	return showAskerEntry ? (
		<PersonalDisplayControls
			preferences={preferences}
			onChange={update}
			placement={placement}
		/>
	) : null;
};

interface DisplayFieldsProps {
	preferences: DisplayPreferences;
	onChange: (preferences: DisplayPreferences) => void;
}

export const PersonalDisplayControls = ({
	preferences,
	onChange,
	placement = 'navigation'
}: DisplayFieldsProps & { placement?: DisplayPlacement }) => {
	const [open, setOpen] = useState(false);
	const { fromL } = useResponsive();
	const dialogId = useId();
	const { t } = useTranslation();

	return (
		<>
			<Button
				className={`personalDisplayEntry personalDisplayEntry--${placement}`}
				item={{
					type: BUTTON_TYPES.TERTIARY,
					title: t('personalDisplay.title')
				}}
				ariaHasPopup="dialog"
				ariaExpanded={open}
				ariaControls={open ? dialogId : undefined}
				buttonHandle={() => setOpen(true)}
			>
				<span className="personalDisplayEntry__icon">
					<ZoomInIcon aria-hidden />
				</span>
				<span className="personalDisplayEntry__label">
					{t('personalDisplay.title')}
				</span>
			</Button>
			<M3Dialog
				id={dialogId}
				open={open}
				title={t('personalDisplay.title')}
				closeLabel={t('app.close')}
				onClose={() => setOpen(false)}
				width={400}
				showDivider={false}
				motion={fromL ? undefined : 'bottom-sheet'}
				className={clsx(
					'personalDisplayDialog',
					!fromL && 'appNavigationSheet',
					!fromL &&
						placement === 'conversation' &&
						'appNavigationSheet--withoutBar'
				)}
			>
				<PersonalDisplayFields
					preferences={preferences}
					onChange={onChange}
				/>
			</M3Dialog>
		</>
	);
};

const PersonalDisplayFields = ({
	preferences,
	onChange
}: DisplayFieldsProps) => {
	const { t } = useTranslation();
	const fieldId = useId();

	const [pendingSize, setPendingSize] = useState<TextSize>();
	const size = pendingSize ?? preferences.textSize;
	const saveSize = () => {
		onChange({ ...preferences, textSize: size });
		setPendingSize(undefined);
	};

	const step = (direction: -1 | 1) => {
		const next = getNextTextSize(size, direction);
		const Icon = direction < 0 ? RemoveIcon : AddIcon;
		return (
			<IconButton
				className="personalDisplaySize__step"
				aria-label={t(
					direction < 0
						? 'personalDisplay.smaller'
						: 'personalDisplay.larger'
				)}
				disabled={next === size}
				onClick={() => setPendingSize(next)}
			>
				<Icon aria-hidden />
			</IconButton>
		);
	};

	return (
		<>
			<fieldset className="personalDisplayGroup">
				<legend>
					<ZoomInIcon aria-hidden />
					{t('personalDisplay.textSize')}
				</legend>
				<div className="personalDisplaySize">
					{step(-1)}
					<output
						aria-label={t('personalDisplay.currentSize')}
						style={{ fontSize: `${(1.125 * size) / 100}rem` }}
					>
						{size} %
					</output>
					{step(1)}
				</div>
				<MuiButton
					variant="contained"
					className="personalDisplaySize__save"
					aria-disabled={size === preferences.textSize}
					onClick={
						size === preferences.textSize ? undefined : saveSize
					}
				>
					{t('app.save')}
				</MuiButton>
			</fieldset>
			<div className="personalDisplayGroup">
				<div id={`${fieldId}-scheme-label`}>
					{t('personalDisplay.schemeLabel')}
				</div>
				<RadioGroup
					row
					className="personalDisplayChoices"
					name={`${fieldId}-scheme`}
					aria-labelledby={`${fieldId}-scheme-label`}
					value={preferences.scheme}
				>
					{schemes.map((scheme) => (
						<FormControlLabel
							key={scheme}
							value={scheme}
							control={
								<Radio
									icon={<span aria-hidden />}
									checkedIcon={<CheckIcon />}
								/>
							}
							label={
								<span className="personalDisplayChoiceLabel">
									{t(`personalDisplay.scheme.${scheme}`)}
								</span>
							}
							disableTypography
							onChange={() =>
								onChange({ ...preferences, scheme })
							}
						/>
					))}
				</RadioGroup>
			</div>
			<div className="personalDisplayGroup">
				<div id={`${fieldId}-contrast-label`}>
					{t('personalDisplay.contrastLabel')}
				</div>
				<RadioGroup
					row
					className="personalDisplayChoices"
					name={`${fieldId}-contrast`}
					aria-labelledby={`${fieldId}-contrast-label`}
					value={preferences.contrast}
				>
					{CONTRAST_OPTIONS.map((contrast) => (
						<FormControlLabel
							key={contrast}
							value={contrast}
							control={
								<Radio
									icon={<span aria-hidden />}
									checkedIcon={<CheckIcon />}
								/>
							}
							label={
								<span className="personalDisplayChoiceLabel">
									{t(`personalDisplay.contrast.${contrast}`)}
								</span>
							}
							disableTypography
							onChange={() =>
								onChange({ ...preferences, contrast })
							}
						/>
					))}
				</RadioGroup>
			</div>
		</>
	);
};

export const PersonalDisplayProfilePanel = ({
	preferences,
	onChange
}: DisplayFieldsProps) => {
	const { t } = useTranslation();
	return (
		<div className="personalDisplayProfile">
			<div className="profile__content__title personalDisplayProfile__title">
				<AccessibilityNewIcon aria-hidden />
				<Headline
					text={t('personalDisplay.accessibility')}
					semanticLevel="5"
				/>
			</div>
			<PersonalDisplayFields
				preferences={preferences}
				onChange={onChange}
			/>
		</div>
	);
};

export const PersonalDisplayProfile = () => {
	const { available, preferences, update } = usePersonalDisplay();
	return available ? (
		<PersonalDisplayProfilePanel
			preferences={preferences}
			onChange={update}
		/>
	) : null;
};
