import * as React from 'react';
import { mount } from 'cypress/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { Spinner } from '../../src/components/spinner/Spinner';
import germanCommon from '../../src/resources/i18n/de/common.json';

describe('Spinner', () => {
	it('mounts an accessible loading status in the browser', () => {
		const translations = createInstance();
		void translations.init({
			lng: 'de',
			fallbackLng: false,
			ns: ['common'],
			defaultNS: 'common',
			resources: { de: { common: germanCommon } },
			initImmediate: false
		});
		mount(
			<I18nextProvider i18n={translations}>
				<Spinner className="component-test-spinner" />
			</I18nextProvider>
		);

		cy.get('[data-cy-root]')
			.find('[role="status"].component-test-spinner')
			.should(($status) => {
				expect($status).to.have.length(1);
				expect($status.attr('aria-live')).to.equal('polite');
				expect(
					$status.attr('aria-label'),
					'accessible loading name'
				).to.equal('Bitte warten');
			});
	});
});
