<#ftl output_format="plainText">
${msg("orisoResetHeadline")}
========================================

${msg("orisoResetBody1", (properties.orisoPlatformName)!'Online-Beratung')}

${msg("orisoResetBody2", linkExpirationFormatter(linkExpiration))}

${msg("orisoResetCtaLabel")}:
${link}

${msg("orisoResetFootnote")}

----------------------------------------------------------------
${msg("orisoResetAssurance")}

${(properties.orisoOrgName)!'ORISO'}
${(properties.orisoOrgAddress)!''}
${(properties.orisoContactLine)!''}

${msg("orisoResetOfferedBy", (properties.orisoPlatformName)!'Online-Beratung', (properties.orisoOrgName)!'ORISO')}

${msg("orisoResetFooterLink1")}: ${(properties.orisoPrivacyUrl)!'https://app.oriso.org/datenschutz'}
${msg("orisoResetFooterLink2")}: ${(properties.orisoImprintUrl)!'https://app.oriso.org/impressum'}

${msg("orisoResetAutomatedNote")}
