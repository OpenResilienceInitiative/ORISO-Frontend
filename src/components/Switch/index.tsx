import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '../text/Text';
import styles from './switch.module.scss';

export interface SwitchProps
	extends Omit<
		React.InputHTMLAttributes<HTMLInputElement>,
		'type' | 'checked' | 'onChange'
	> {
	checked: boolean;
	onChange: (
		checked: boolean,
		event: React.ChangeEvent<HTMLInputElement>
	) => void;
	titleKey?: string;
	descriptionKey?: string;
	showIcon?: boolean;
}

export const Switch = ({
	titleKey,
	descriptionKey,
	showIcon = true,
	className,
	checked,
	onChange,
	disabled,
	...props
}: SwitchProps) => {
	const { t } = useTranslation();
	const title = titleKey ? t(titleKey) : undefined;

	const switchClassName = [
		styles.switch,
		className,
		disabled ? styles.disabled : ''
	]
		.filter(Boolean)
		.join(' ');

	const switchControl = (
		<label className={switchClassName}>
			<input
				{...props}
				aria-label={props['aria-label'] || title}
				checked={checked}
				className={styles.input}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked, event)}
				role="switch"
				type="checkbox"
			/>
			<span className={styles.track} aria-hidden="true">
				<span className={styles.target}>
					<span className={styles.handle}>
						{showIcon && <span className={styles.icon} />}
					</span>
				</span>
			</span>
		</label>
	);

	if (!titleKey && !descriptionKey) {
		return switchControl;
	}

	return (
		<div className="mb--2">
			<div className="flex flex--jc-sb ">
				<Text text={title} type="standard" />
				{switchControl}
			</div>
			{descriptionKey && (
				<Text
					text={t(descriptionKey)}
					type="infoMedium"
					className={styles.description}
				/>
			)}
		</div>
	);
};
