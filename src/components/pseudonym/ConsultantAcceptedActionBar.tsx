import React from 'react';
import { useTranslation } from 'react-i18next';
import './ConsultantAcceptedActionBar.styles.scss';

interface ConsultantAcceptedActionBarProps {
	/** Dismiss the accepted banner (keeps the session visible, just hides this prompt). */
	onDismiss: () => void;
	/** Accept and open the live chat composer. */
	onStartChat: () => void;
}

/** Curved down-arrow icon (↵) — points the asker from the hint text to the button. */
const DownTurnArrowIcon: React.FC = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M10 15L15 20M15 20L20 15M15 20V8C15 6.93913 14.5786 5.92172 13.8284 5.17157C13.0783 4.42143 12.0609 4 11 4H4"
			stroke="#4C555F"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

/** Close (X) glyph used on the dismiss pill. */
const CloseIcon: React.FC = () => (
	<svg
		width="48"
		height="48"
		viewBox="0 0 48 48"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M12.8 38L10 35.2L21.2 24L10 12.8L12.8 10L24 21.2L35.2 10L38 12.8L26.8 24L38 35.2L35.2 38L24 26.8L12.8 38Z"
			fill="#4C555F"
		/>
	</svg>
);

/**
 * Action bar shown after the counselor has accepted the anonymous enquiry.
 * Matches Figma "StandardButtonGroup":
 *
 *   Sie werden jetzt von ihrer Berater_in im Chat erwartet.  ↵
 *
 *   ┌─────┐   ┌─────────────────────────────────────┐
 *   │  ×  │   │          Start chat now             │
 *   └─────┘   └─────────────────────────────────────┘
 */
export const ConsultantAcceptedActionBar: React.FC<
	ConsultantAcceptedActionBarProps
> = ({ onDismiss, onStartChat }) => {
	const { t } = useTranslation();

	return (
		<div className="consultantAcceptedActionBar" role="group">
			<div className="consultantAcceptedActionBar__hint">
				<p className="consultantAcceptedActionBar__hintText">
					{t(
						'anonymousChat.queue.consultantAccepted',
						'Sie werden jetzt von ihrer Berater_in im Chat erwartet.'
					)}
				</p>
				<span
					className="consultantAcceptedActionBar__hintArrow"
					aria-hidden="true"
				>
					<DownTurnArrowIcon />
				</span>
			</div>

			<div className="consultantAcceptedActionBar__row">
				<button
					type="button"
					className="consultantAcceptedActionBar__dismissBtn"
					onClick={onDismiss}
					aria-label={t(
						'anonymousChat.queue.dismissAcceptedBanner',
						'Hinweis ausblenden'
					)}
				>
					<CloseIcon />
				</button>

				<button
					type="button"
					className="consultantAcceptedActionBar__startBtn"
					onClick={onStartChat}
				>
					<span className="consultantAcceptedActionBar__startBtnLabel">
						{t(
							'anonymousChat.queue.startChatNow',
							'Jetzt Chat starten'
						)}
					</span>
				</button>
			</div>
		</div>
	);
};
