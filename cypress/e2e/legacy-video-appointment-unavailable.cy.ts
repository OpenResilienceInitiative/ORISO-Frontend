describe('legacy video appointment URLs', () => {
	[
		'/videoberatung/app/appointment-123',
		'/consultant/videoberatung/app/appointment-123'
	].forEach((path) =>
		it(`shows an unavailable state without loading a call for ${path}`, () => {
			let callRequests = 0;
			cy.intercept('/service/videocalls/**', () => {
				callRequests += 1;
			});

			cy.visit(path);

			cy.contains('Video-Termine sind derzeit nicht verfügbar.').should(
				'exist'
			);
			cy.get('iframe').should('not.exist');
			cy.then(() => expect(callRequests).to.equal(0));
		})
	);
});
