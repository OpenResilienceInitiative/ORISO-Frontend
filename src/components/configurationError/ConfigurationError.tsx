import * as React from 'react';
import type { RuntimeConfigProblem } from '../../resources/scripts/runtimeConfig';
import './configurationError.styles.scss';

// Rendered before i18n, tenant theme and API are available, so the text is
// static and bilingual. Operators read it; the key names are the point.

const PROBLEM_TEXT: Record<RuntimeConfigProblem['problem'], string> = {
	missing: 'missing / fehlt',
	invalid: 'invalid URL / ungültige URL'
};

export const reportRuntimeConfigProblems = (
	problems: RuntimeConfigProblem[]
): void => {
	problems.forEach(({ key, problem }) => {
		console.error(
			`[config] ${key} is ${problem === 'missing' ? 'not set' : 'not a valid URL'}. ` +
				'Set it in the runtime config (config.js / container env).'
		);
	});
};

export const ConfigurationError = ({
	problems
}: {
	problems: RuntimeConfigProblem[];
}) => (
	<main className="configurationError" data-cy="configuration-error">
		<div className="configurationError__card">
			<h1 className="configurationError__headline">
				Configuration error
			</h1>
			<p className="configurationError__text">
				This app cannot start because required runtime settings are
				missing. Please contact the operator of this site.
			</p>
			<p className="configurationError__text" lang="de">
				Die Anwendung kann nicht starten, weil Pflicht-Einstellungen
				fehlen. Bitte wenden Sie sich an den Betrieb dieser Seite.
			</p>
			<ul className="configurationError__list">
				{problems.map(({ key, problem }) => (
					<li key={key} className="configurationError__item">
						<code>{key}</code>
						<span className="configurationError__problem">
							{PROBLEM_TEXT[problem]}
						</span>
					</li>
				))}
			</ul>
		</div>
	</main>
);
