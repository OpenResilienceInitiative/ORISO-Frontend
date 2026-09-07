import * as React from 'react';
import { useId, useState } from 'react';
import { ReactComponent as ChevronDownIcon } from '../../resources/img/icons/keyboard_arrow_down.svg';
import './ErstantwortDisclosure.styles.scss';

/**
 * One collapsible question row inside a Carimat bubble — the atom the FAQ
 * layout proposal is built from (`VORSCHLAG-erstantwort-faq-layout-2026-09-07.md`).
 *
 * **Why a new component rather than an existing one.** The repository has two
 * disclosures already, and neither fits here:
 * `registration/zipcodeInput/WhyLocalDisclosure.tsx` and
 * `departmentLegal/DepartmentLegalSection.tsx` are both MUI
 * (`Collapse` + `ButtonBase` / `Button`) drawing their colours from
 * `registrationDesign.registrationMd3`. The chat surface is plain SCSS on the
 * `--m3-*` custom properties and pulls in no MUI at all
 * (`grep '@mui/material' src/components/message src/components/erstantwort
 * src/components/pseudonym` finds nothing), so reusing either would drag the
 * registration theme and the MUI runtime into the message stream for four rows.
 * MUI's `Accordion` (used in `registration/topicSelection/TopicSelection.tsx`)
 * has the same problem plus its own paper/summary chrome.
 *
 * **Why not `<details>`/`<summary>`.** `summary` carries a `list-item` display
 * and a UA marker that has to be shot down per browser, it cannot animate its
 * own height, and Safari still exposes the open state inconsistently to
 * VoiceOver. A `button[aria-expanded][aria-controls]` plus a labelled region is
 * the plain ARIA disclosure pattern, gets Enter/Space for free from the native
 * button, and takes the platform's focus-ring convention without a fight.
 *
 * The closed state must survive a screen reader honestly: the panel is
 * unmounted, not merely hidden, so nothing collapsed is read out or reachable
 * by Tab.
 */

export interface ErstantwortDisclosureProps {
	/** The row's question, shown on the button. */
	question: string;
	/** The answer. Rendered only while open. */
	children: React.ReactNode;
	/** Start expanded. The FAQ bubble opens its first row, nothing else. */
	defaultOpen?: boolean;
	/** Stable id fragment for tests and screenshots. */
	testId?: string;
}

export const ErstantwortDisclosure: React.FC<ErstantwortDisclosureProps> = ({
	question,
	children,
	defaultOpen = false,
	testId
}) => {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	/* React's own id, so two disclosures with the same question text still get
	   distinct `aria-controls` targets. */
	const reactId = useId();
	const panelId = `erstantwort-disclosure-panel-${reactId}`;
	const buttonId = `erstantwort-disclosure-button-${reactId}`;

	return (
		<div
			className={`erstantwortDisclosure${
				isOpen ? ' erstantwortDisclosure--open' : ''
			}`}
			data-testid={testId}
		>
			<button
				type="button"
				id={buttonId}
				className="erstantwortDisclosure__toggle"
				aria-expanded={isOpen}
				aria-controls={panelId}
				onClick={() => setIsOpen((current) => !current)}
			>
				<span className="erstantwortDisclosure__question">
					{question}
				</span>
				<span
					className="erstantwortDisclosure__chevron"
					aria-hidden="true"
				>
					<ChevronDownIcon />
				</span>
			</button>
			{isOpen && (
				<div
					id={panelId}
					role="region"
					aria-labelledby={buttonId}
					className="erstantwortDisclosure__panel"
				>
					{children}
				</div>
			)}
		</div>
	);
};
