import React, { useState } from 'react';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Headline } from '../headline/Headline';
import { ReactComponent as NewWindow } from '../../resources/img/icons/new-window.svg';
import { ReactComponent as CopyIcon } from '../../resources/img/icons/documents.svg';
import ChromeLogo from '../../resources/img/images/google_chrome.png';
import EdgeLogo from '../../resources/img/images/microsoft_edge.png';
import SafariLogo from '../../resources/img/images/safari.png';
import { useTranslation } from 'react-i18next';

const browserChromeUrl =
	process.env.REACT_APP_BROWSER_DOWNLOAD_CHROME_URL ||
	'https://www.google.com/chrome/';
const browserEdgeUrl =
	process.env.REACT_APP_BROWSER_DOWNLOAD_EDGE_URL ||
	'https://www.microsoft.com/edge';
const browserSafariUrl =
	process.env.REACT_APP_BROWSER_DOWNLOAD_SAFARI_URL ||
	'https://www.apple.com/de/safari/';

interface HelpVideoCallProps {
	copyLoginLink: Function;
	consultant: boolean;
}

export const BrowserList: React.FC = () => {
	const { t: translate } = useTranslation();
	return (
		<div className="browser-list">
			<div>
				<img
					src={ChromeLogo}
					alt={translate('help.googleChrome')}
					title={translate('help.googleChrome')}
				/>
				<a
					href={browserChromeUrl}
					target="_blank"
					rel="noreferrer"
					className="button-as-link"
				>
					<NewWindow
						title={translate('help.openInNewTab')}
						aria-label={translate('help.openInNewTab')}
					/>{' '}
					{translate('help.googleChrome')}
				</a>
			</div>
			<div>
				<img
					src={EdgeLogo}
					alt={translate('help.msEdge')}
					title={translate('help.msEdge')}
				/>
				<a
					href={browserEdgeUrl}
					target="_blank"
					rel="noreferrer"
					className="button-as-link"
				>
					<NewWindow
						title={translate('help.openInNewTab')}
						aria-label={translate('help.openInNewTab')}
					/>{' '}
					{translate('help.msEdge')}
				</a>
			</div>
			<div>
				<img
					src={SafariLogo}
					alt={translate('help.safari')}
					title={translate('help.safari')}
				/>
				<a
					href={browserSafariUrl}
					target="_blank"
					rel="noreferrer"
					className="button-as-link"
				>
					<NewWindow
						title={translate('help.openInNewTab')}
						aria-label={translate('help.openInNewTab')}
					/>{' '}
					{translate('help.safari')}
				</a>
			</div>
		</div>
	);
};

export const HelpVideoCall: React.FC<HelpVideoCallProps> = ({
	copyLoginLink,
	consultant
}) => {
	const { t: translate } = useTranslation();
	const [index, setIndex] = useState(0);
	const elementCallPrefix = `help.videoCall.elementCall.${
		consultant ? 'consultant' : 'asker'
	}`;
	const stepsHeadline = translate('help.videoCall.elementCall.stepsHeadline');
	const troubleshooting = 'help.videoCall.elementCall.troubleshooting';

	// #1540: one compact card to click through instead of a full page of text.
	const slides: { kicker?: string; step?: number; body: React.ReactNode }[] =
		[
			{ body: translate(`${elementCallPrefix}.intro`) },
			...['open', 'permissions', 'call'].map((key, i) => ({
				kicker: stepsHeadline,
				step: i + 1,
				body: translate(`${elementCallPrefix}.steps.${key}`)
			})),
			{
				kicker: stepsHeadline,
				step: 4,
				body: (
					<>
						{translate(`${elementCallPrefix}.steps.copyLink`)}
						<button
							className="help__copyLink"
							type="button"
							onClick={() => copyLoginLink()}
							title={translate('help.videoCall.loginLink.title')}
						>
							<CopyIcon
								className="copy icn--s"
								aria-hidden="true"
							/>
							{translate('help.videoCall.loginLink.text')}
						</button>
					</>
				)
			},
			{
				kicker: translate(
					'help.videoCall.elementCall.troubleshootingHeadline'
				),
				body: (
					<ul className="help__tips">
						<li>{translate(`${troubleshooting}.permissions`)}</li>
						<li>{translate(`${troubleshooting}.device`)}</li>
						<li>{translate(`${troubleshooting}.connection`)}</li>
					</ul>
				)
			}
		];
	const slide = slides[index];
	const go = (delta: number) =>
		setIndex(
			(current) => (current + delta + slides.length) % slides.length
		);

	return (
		<div className="help__carousel">
			<div className="profile__content__title">
				<Headline
					text={translate(`${elementCallPrefix}.headline`)}
					semanticLevel="5"
				/>
			</div>
			<div className="help__slide" aria-live="polite">
				{slide.kicker && (
					<span className="help__slideKicker">
						{slide.step && (
							<span className="help__slideStep">
								{slide.step}
							</span>
						)}
						{slide.kicker}
					</span>
				)}
				<div className="help__slideBody">{slide.body}</div>
			</div>
			<div className="help__slideNav">
				<button
					type="button"
					className="help__slideArrow"
					onClick={() => go(-1)}
					aria-label={translate('app.back')}
				>
					<ChevronLeftRoundedIcon aria-hidden="true" />
				</button>
				<div className="help__slideDots" aria-hidden="true">
					{slides.map((_, i) => (
						<span
							key={i}
							className={`help__slideDot${
								i === index ? ' help__slideDot--active' : ''
							}`}
						/>
					))}
				</div>
				<button
					type="button"
					className="help__slideArrow"
					onClick={() => go(1)}
					aria-label={translate('app.next')}
				>
					<ChevronRightRoundedIcon aria-hidden="true" />
				</button>
			</div>
		</div>
	);
};
