<#ftl output_format="plainText">
${msg("orisoOtpHeadline")}
========================================

${msg("orisoOtpBody1")}

${msg("orisoOtpCodeLabel")}: ${otp}

${msg("orisoOtpFootnote")}

----------------------------------------------------------------
${msg("orisoOtpAssurance")}

${(properties.orisoOrgName)!'ORISO'}
${(properties.orisoOrgAddress)!''}
${(properties.orisoContactLine)!''}

${msg("orisoOtpOfferedBy", (properties.orisoPlatformName)!'Online-Beratung', (properties.orisoOrgName)!'ORISO')}

${msg("orisoOtpFooterLink1")}: ${(properties.orisoPrivacyUrl)!'https://app.oriso.org/datenschutz'}
${msg("orisoOtpFooterLink2")}: ${(properties.orisoImprintUrl)!'https://app.oriso.org/impressum'}

${msg("orisoOtpAutomatedNote")}
