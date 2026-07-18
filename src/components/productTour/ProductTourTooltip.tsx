import * as React from 'react';
import type { TooltipRenderProps } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { Button, BUTTON_TYPES } from '../button/Button';
import './productTour.styles.scss';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/x.svg';

/**
 * Frontend-styled Joyride tooltip. Titles and contents arrive as i18n keys
 * (set by mapStepsToJoyride) and are translated here; step copy may contain
 * static markup like <br /> from the translation bundles, matching the
 * legacy intro.js rendering.
 */
export const ProductTourTooltip = ({
	index,
	size,
	isLastStep,
	step,
	backProps,
	closeProps,
	primaryProps,
	tooltipProps
}: TooltipRenderProps) => {
	const { t: translate } = useTranslation();

	const nextLabel = isLastStep
		? translate('walkthrough.step.done')
		: translate('walkthrough.step.next');

	return (
		<div
			className="productTourTooltip"
			role="alertdialog"
			aria-label={translate(String(step.title))}
			{...tooltipProps}
		>
			<div className="productTourTooltip__header">
				<h2 className="productTourTooltip__title">
					{translate(String(step.title))}
				</h2>
				<button
					type="button"
					className="productTourTooltip__close"
					onClick={closeProps.onClick as any}
					aria-label={translate('walkthrough.close')}
				>
					<CloseIcon aria-hidden="true" focusable="false" />
				</button>
			</div>
			<div
				className="productTourTooltip__content"
				dangerouslySetInnerHTML={{
					__html: translate(String(step.content))
				}}
			/>
			<div className="productTourTooltip__actions">
				{index > 0 && (
					<Button
						item={{
							label: translate('walkthrough.step.prev'),
							type: BUTTON_TYPES.SECONDARY
						}}
						buttonHandle={backProps.onClick as any}
						className="productTourTooltip__back"
					/>
				)}
				<Button
					item={{
						label: nextLabel,
						type: BUTTON_TYPES.PRIMARY
					}}
					buttonHandle={primaryProps.onClick as any}
					className="productTourTooltip__next"
				/>
			</div>
			<div className="productTourTooltip__footer">
				<span
					className="productTourTooltip__progress"
					aria-live="polite"
				>
					{`${translate('walkthrough.step.step')} ${index + 1} ${translate(
						'walkthrough.step.of'
					)} ${size}`}
				</span>
				<div className="productTourTooltip__bullets" aria-hidden="true">
					{Array.from({ length: size }, (_, bulletIndex) => (
						<span
							key={bulletIndex}
							className={
								bulletIndex === index
									? 'productTourTooltip__bullet productTourTooltip__bullet--active'
									: 'productTourTooltip__bullet'
							}
						/>
					))}
				</div>
			</div>
		</div>
	);
};
