import * as React from 'react';
import { mount } from 'cypress/react';
import { Spinner } from '../../src/components/spinner/Spinner';

describe('Spinner', () => {
	it('mounts an accessible loading status in the browser', () => {
		mount(<Spinner className="component-test-spinner" />);

		cy.get('[data-cy-root]')
			.find('[role="status"].component-test-spinner')
			.should(($status) => {
				expect($status).to.have.length(1);
				expect($status.attr('aria-live')).to.equal('polite');
				expect(
					$status.attr('aria-label')?.trim(),
					'accessible loading name'
				).to.be.a('string').and.not.be.empty;
			});
	});
});
