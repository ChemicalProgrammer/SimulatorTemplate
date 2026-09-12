function requireCurrentUser_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    throw createSimulatorError_(
      'IDENTITY_UNAVAILABLE',
      'The deployment must identify the active Google user before the console can be used.'
    );
  }

  var allowedEmails = getAllowedUserEmails_();
  if (allowedEmails.length > 0 && allowedEmails.indexOf(email.toLowerCase()) === -1) {
    throw createSimulatorError_('ACCESS_DENIED', 'This Google user is not allowed to use the console.');
  }

  return { email: email.toLowerCase() };
}

function getAllowedUserEmails_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ALLOWED_USER_EMAILS_JSON');
  if (!raw) return [];

  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(function(email) { return typeof email === 'string'; }).map(function(email) { return email.toLowerCase(); })
      : [];
  } catch (error) {
    throw createSimulatorError_('INVALID_GLOBAL_CONFIGURATION', 'ALLOWED_USER_EMAILS_JSON must contain a JSON array of email addresses.');
  }
}
