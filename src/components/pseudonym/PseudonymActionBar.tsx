import React from 'react';
import { useTranslation } from 'react-i18next';
import './PseudonymActionBar.styles.scss';

interface PseudonymActionBarProps {
	onRegenerate: () => void;
	onConfirm: () => void;
	disabled?: boolean;
}

/**
 * 3×3 "dice" pattern icon — exact positions from Figma node 1320:38837
 * (9 cells, 3 pink / 6 white, 11×11 each, 19px grid step inside a 48×48 box).
 */
const DicePatternIcon: React.FC = () => {
	const cell = {
		position: 'absolute' as const,
		width: 11,
		height: 11,
		borderRadius: 5.3
	};
	return (
		<span className="pseudonymActionBar__dice" aria-hidden="true">
			{/* Pink cells */}
			<span
				style={{ ...cell, left: 37, top: 0, background: '#FFB3BA' }}
			/>
			<span
				style={{ ...cell, left: 0, top: 37, background: '#FFB3BA' }}
			/>
			<span
				style={{ ...cell, left: 19, top: 19, background: '#FFB3BA' }}
			/>
			{/* White cells */}
			<span style={{ ...cell, left: 0, top: 0, background: '#FFFFFF' }} />
			<span
				style={{ ...cell, left: 37, top: 37, background: '#FFFFFF' }}
			/>
			<span
				style={{ ...cell, left: 0, top: 19, background: '#FFFFFF' }}
			/>
			<span
				style={{ ...cell, left: 37, top: 19, background: '#FFFFFF' }}
			/>
			<span
				style={{ ...cell, left: 19, top: 0, background: '#FFFFFF' }}
			/>
			<span
				style={{ ...cell, left: 19, top: 37, background: '#FFFFFF' }}
			/>
		</span>
	);
};

export const PseudonymActionBar: React.FC<PseudonymActionBarProps> = ({
	onRegenerate,
	onConfirm,
	disabled
}) => {
	const { t } = useTranslation();

	return (
		<div
			className="pseudonymActionBar"
			role="group"
			aria-label={t(
				'anonymousChat.pseudonym.actionsLabel',
				'Pseudonym-Aktionen'
			)}
		>
			<button
				type="button"
				className="pseudonymActionBar__btnChange"
				onClick={onRegenerate}
				disabled={disabled}
			>
				<DicePatternIcon />
				<span className="pseudonymActionBar__btnChangeLabel">
					{t('anonymousChat.pseudonym.changeName', 'Name ändern')}
				</span>
			</button>

			<button
				type="button"
				className="pseudonymActionBar__btnContinue"
				onClick={onConfirm}
				disabled={disabled}
			>
				<span className="pseudonymActionBar__btnContinueLabel">
					{t(
						'anonymousChat.pseudonym.continueWithSelection',
						'Weiter mit Auswahl'
					)}
				</span>
			</button>
		</div>
	);
};
