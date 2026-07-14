import React, { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectChangeEvent } from '@mui/material/Select';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Headline } from '../../../components/headline/Headline';
import { Text } from '../../../components/text/Text';
import { OrisoSelect } from '../../../components/form/OrisoSelect';
import { Button, BUTTON_TYPES } from '../../../components/button/Button';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_SUCCESS
} from '../../../globalState/provider/NotificationsProvider';
import { useKeyboardShortcuts } from '../context/KeyboardShortcutsProvider';
import {
	getSettingsShortcutRows,
	SETTINGS_CATEGORY_ORDER
} from '../constants/registry';
import { ACTION_BINDING_OPTIONS } from '../constants/sendOptions';
import { formatShortcut } from '../utils/format';
import { bindingsEqual } from '../utils/binding';
import {
	getAvailableNewlineOptions,
	resolveNewlineBinding
} from '../utils/deriveNewline';
import { resolveEffectiveBinding } from '../utils/resolveAction';
import {
	DEFAULT_EXPANDED_CATEGORY,
	toggleExclusiveAccordion,
	type ShortcutCategoryId
} from '../utils/accordion';
import {
	bindingToOptionValue,
	optionValueToBinding
} from '../storage/preferenceStore';
import type {
	Platform,
	ShortcutActionId,
	ShortcutBinding,
	ShortcutDefinition
} from '../types';
import '../../../components/profile/profile.styles';
import './KeyboardShortcutsSettings.styles.scss';

const useShortcutLabels = () => {
	const { t } = useTranslation();
	return useMemo(
		() => ({
			ctrl: t('shortcuts.keys.ctrl', { defaultValue: 'Ctrl' }),
			cmd: t('shortcuts.keys.cmd', { defaultValue: 'Cmd' }),
			alt: t('shortcuts.keys.alt', { defaultValue: 'Alt' }),
			option: t('shortcuts.keys.option', { defaultValue: 'Option' }),
			shift: t('shortcuts.keys.shift', { defaultValue: 'Shift' }),
			enter: t('shortcuts.keys.enter', { defaultValue: 'Enter' }),
			escape: t('shortcuts.keys.escape', { defaultValue: 'Esc' }),
			arrowUp: t('shortcuts.keys.arrowUp', { defaultValue: '↑' })
		}),
		[t]
	);
};

const toSelectOptions = (
	bindings: ShortcutBinding[],
	platform: Platform,
	labels: ReturnType<typeof useShortcutLabels>,
	extra?: { value: string; label: string }[]
) => [
	...bindings.map((binding) => ({
		value: bindingToOptionValue(binding),
		label: formatShortcut(binding, platform, { symbolic: true, labels })
	})),
	...(extra ?? [])
];

/** Map any stored binding onto a canonical option value so MUI never shows raw ids. */
const resolveSelectValue = (
	binding: ShortcutBinding | null,
	options: ShortcutBinding[],
	platform: Platform,
	canDisable: boolean
): string => {
	if (binding === null) {
		return canDisable ? 'disabled' : bindingToOptionValue(options[0]);
	}
	const matched = options.find((option) =>
		bindingsEqual(option, binding, platform)
	);
	if (matched) {
		return bindingToOptionValue(matched);
	}
	return bindingToOptionValue(options[0] ?? binding);
};

export const KeyboardShortcutsSettings = () => {
	const { t: translate } = useTranslation();
	const labels = useShortcutLabels();
	const {
		platform,
		preferences,
		setBinding,
		restoreDefaults,
		isNewlineLocked,
		getWarningsForBinding
	} = useKeyboardShortcuts();
	const notifications = React.useContext(NotificationsContext);
	const [errorKey, setErrorKey] = useState<string | null>(null);
	const [warningKey, setWarningKey] = useState<string | null>(null);
	const [confirmRestore, setConfirmRestore] = useState(false);
	const [expanded, setExpanded] = useState<ShortcutCategoryId | null>(
		DEFAULT_EXPANDED_CATEGORY
	);
	const errorId = useId();
	const warningId = useId();
	const liveId = useId();

	const sendBinding =
		resolveEffectiveBinding(preferences, 'chat.sendMessage', platform) ??
		ACTION_BINDING_OPTIONS['chat.sendMessage'][0];
	const newlineBinding = resolveNewlineBinding(
		sendBinding,
		preferences.bindings['chat.insertNewLine'],
		platform
	);

	const newlineOptions = useMemo(
		() => getAvailableNewlineOptions(sendBinding, platform),
		[sendBinding, platform]
	);

	const rowsByCategory = useMemo(() => {
		const rows = getSettingsShortcutRows();
		return SETTINGS_CATEGORY_ORDER.map((category) => ({
			category,
			rows: rows.filter((row) => row.category === category)
		})).filter((group) => group.rows.length > 0);
	}, []);

	const applyBinding = (
		actionId: ShortcutActionId,
		binding: ShortcutBinding | null
	) => {
		const result = setBinding(actionId, binding);
		if (result.ok === false) {
			setErrorKey(
				result.conflicts[0]?.messageTranslationKey ??
					'shortcuts.conflicts.duplicate'
			);
			setWarningKey(null);
			return;
		}
		setErrorKey(null);
		const warnings =
			result.warnings ?? getWarningsForBinding(actionId, binding);
		setWarningKey(warnings[0]?.messageTranslationKey ?? null);
	};

	const handleSelect =
		(actionId: ShortcutActionId, options: ShortcutBinding[]) =>
		(event: SelectChangeEvent<string>) => {
			if (event.target.value === 'disabled') {
				applyBinding(actionId, null);
				return;
			}
			const next = optionValueToBinding(event.target.value, options);
			if (!next) {
				return;
			}
			applyBinding(actionId, next);
		};

	const handleResetAction = (actionId: ShortcutActionId) => {
		const def = rowsByCategory
			.flatMap((g) => g.rows)
			.find((r) => r.id === actionId);
		if (!def) {
			return;
		}
		applyBinding(actionId, def.defaultBinding);
	};

	const handleRestoreConfirm = () => {
		restoreDefaults();
		setConfirmRestore(false);
		setErrorKey(null);
		setWarningKey(null);
		notifications?.addNotification({
			notificationType: NOTIFICATION_TYPE_SUCCESS,
			title: translate('shortcuts.restoreDefaults'),
			text: translate('shortcuts.restoreDefaultsSuccess')
		});
	};

	const renderControl = (def: ShortcutDefinition) => {
		const options =
			def.id === 'chat.insertNewLine'
				? newlineOptions
				: (ACTION_BINDING_OPTIONS[def.id] ?? def.supportedBindings);

		const current =
			def.id === 'chat.insertNewLine'
				? newlineBinding
				: resolveEffectiveBinding(preferences, def.id, platform);

		const selectValue = resolveSelectValue(
			current ?? null,
			options,
			platform,
			def.canDisable
		);

		const extra = def.canDisable
			? [
					{
						value: 'disabled',
						label: translate('shortcuts.disableShortcut')
					}
				]
			: undefined;

		const selectOptions = toSelectOptions(options, platform, labels, extra);
		const labelByValue = new Map(
			selectOptions.map((option) => [option.value, option.label])
		);

		return (
			<div className="keyboardShortcutsSettings__controlCluster">
				<OrisoSelect
					id={`shortcut-${def.id.replace(/\./g, '-')}`}
					label={translate(def.labelTranslationKey)}
					options={selectOptions}
					value={selectValue}
					onChange={handleSelect(def.id, options)}
					size="small"
					fullWidth
					disabled={
						def.id === 'chat.insertNewLine' && isNewlineLocked
					}
					renderValue={(value) =>
						labelByValue.get(String(value)) ??
						formatShortcut(current, platform, {
							symbolic: true,
							labels
						})
					}
				/>
				{def.id === 'chat.insertNewLine' && isNewlineLocked && (
					<span className="keyboardShortcutsSettings__hint">
						{translate('shortcuts.lockedNewline')}
					</span>
				)}
				{def.canDisable && (
					<button
						type="button"
						className="keyboardShortcutsSettings__reset"
						onClick={() => handleResetAction(def.id)}
					>
						{translate('shortcuts.resetAction')}
					</button>
				)}
			</div>
		);
	};

	return (
		<div className="keyboardShortcutsSettings">
			<div className="profile__content__title">
				<div className="profile__content__header">
					<Headline
						text={translate('shortcuts.title')}
						semanticLevel="5"
					/>
				</div>
				<Text
					text={translate('shortcuts.description')}
					type="standard"
					className="tertiary"
				/>
			</div>

			<div
				id={liveId}
				className="keyboardShortcutsSettings__live"
				aria-live="polite"
			>
				{errorKey && (
					<p
						id={errorId}
						className="keyboardShortcutsSettings__error"
						role="alert"
					>
						{translate(errorKey)}
					</p>
				)}
				{!errorKey && warningKey && (
					<p
						id={warningId}
						className="keyboardShortcutsSettings__warning"
					>
						{translate(warningKey)}
					</p>
				)}
			</div>

			<div className="keyboardShortcutsSettings__panel">
				{rowsByCategory.map(({ category, rows }) => {
					const isExpanded = expanded === category;
					const panelId = `shortcuts-panel-${category}`;
					const headerId = `shortcuts-header-${category}`;
					return (
						<Accordion
							key={category}
							className="keyboardShortcutsSettings__accordion"
							expanded={isExpanded}
							onChange={() =>
								setExpanded((current) =>
									toggleExclusiveAccordion(
										current,
										category as ShortcutCategoryId
									)
								)
							}
							disableGutters
							elevation={0}
							TransitionProps={{ unmountOnExit: true }}
						>
							<AccordionSummary
								id={headerId}
								aria-controls={panelId}
								expandIcon={<ExpandMoreIcon />}
								className="keyboardShortcutsSettings__summary"
							>
								<span className="keyboardShortcutsSettings__category">
									{translate(
										`shortcuts.categories.${category}`
									)}
								</span>
								<span
									className="keyboardShortcutsSettings__count"
									aria-hidden
								>
									{rows.length}
								</span>
							</AccordionSummary>
							<AccordionDetails
								id={panelId}
								className="keyboardShortcutsSettings__details"
								role="region"
								aria-labelledby={headerId}
							>
								{isExpanded && (
									<ul className="keyboardShortcutsSettings__list">
										{rows.map((def) => (
											<li
												key={def.id}
												className="keyboardShortcutsSettings__row"
											>
												<div className="keyboardShortcutsSettings__meta">
													<span className="keyboardShortcutsSettings__label">
														{translate(
															def.labelTranslationKey
														)}
													</span>
													<span className="keyboardShortcutsSettings__desc">
														{translate(
															def.descriptionTranslationKey
														)}
													</span>
												</div>
												<div className="keyboardShortcutsSettings__control">
													{renderControl(def)}
												</div>
											</li>
										))}
									</ul>
								)}
							</AccordionDetails>
						</Accordion>
					);
				})}
			</div>

			<div className="keyboardShortcutsSettings__actions">
				{!confirmRestore ? (
					<Button
						item={{
							label: translate('shortcuts.restoreDefaults'),
							type: BUTTON_TYPES.SECONDARY,
							id: 'restore-shortcut-defaults'
						}}
						buttonHandle={() => setConfirmRestore(true)}
					/>
				) : (
					<div
						className="keyboardShortcutsSettings__confirm"
						role="group"
						aria-label={translate(
							'shortcuts.restoreDefaultsConfirm'
						)}
					>
						<p>{translate('shortcuts.restoreDefaultsConfirm')}</p>
						<div className="keyboardShortcutsSettings__confirmActions">
							<Button
								item={{
									label: translate(
										'shortcuts.restoreDefaultsConfirmYes'
									),
									type: BUTTON_TYPES.PRIMARY,
									id: 'confirm-restore-shortcut-defaults'
								}}
								buttonHandle={handleRestoreConfirm}
							/>
							<Button
								item={{
									label: translate(
										'shortcuts.restoreDefaultsConfirmNo'
									),
									type: BUTTON_TYPES.SECONDARY,
									id: 'cancel-restore-shortcut-defaults'
								}}
								buttonHandle={() => setConfirmRestore(false)}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
