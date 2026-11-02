import * as React from 'react';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import MicOutlinedIcon from '@mui/icons-material/MicOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import './callShareStage.scss';

/**
 * Story stand-in for a running two-person call (plates 2b / 5b of
 * "Dynamische Call-Ansichten"): the stage and the white toolbar pill, with
 * the real share button in its slot. Everything but that button is
 * decoration and hidden from assistive technology.
 */
export const CallShareStage = ({
	layout,
	shareButton
}: {
	layout: 'desktop' | 'phone';
	shareButton: React.ReactNode;
}) => (
	<div className={`callShareStage callShareStage--${layout}`}>
		<div className="callShareStage__circle" aria-hidden>
			<span className="callShareStage__half callShareStage__half--seeker">
				RF
			</span>
			<span className="callShareStage__half callShareStage__half--counsellor">
				SP
			</span>
		</div>
		<div className="callShareStage__bar">
			<div className="callShareStage__pill">
				<span className="callShareStage__slot" aria-hidden>
					<MicOutlinedIcon />
				</span>
				<span className="callShareStage__slot" aria-hidden>
					<VideocamOutlinedIcon />
				</span>
				<span className="callShareStage__slot" aria-hidden>
					<PanToolOutlinedIcon />
				</span>
				{shareButton}
				{layout === 'desktop' && (
					<>
						<span className="callShareStage__slot" aria-hidden>
							<ChecklistOutlinedIcon />
						</span>
						<span className="callShareStage__slot" aria-hidden>
							<MoreVertOutlinedIcon />
						</span>
					</>
				)}
			</div>
			<span className="callShareStage__hangup" aria-hidden>
				<CallEndIcon />
				{layout === 'desktop' && <span>Auflegen</span>}
			</span>
		</div>
	</div>
);
