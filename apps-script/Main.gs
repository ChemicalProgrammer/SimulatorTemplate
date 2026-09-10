function doGet() {
  return HtmlService.createTemplateFromFile('WebApp')
    .evaluate()
    .setTitle('SimulatorTemplate');
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getBootstrap() {
  return executeServerAction_(function(user) {
    return {
      user: user,
      globalConfig: getClientSafeGlobalConfig_(),
      settings: getUserSettings_(),
      cases: listCases_(user)
    };
  });
}

function saveUserSettings(request) {
  return executeServerAction_(function() {
    return saveUserSettings_(request);
  });
}

function createCase(request) {
  return executeServerAction_(function(user) {
    return createCase_(request, user);
  });
}

function getCase(caseId) {
  return executeServerAction_(function(user) {
    return getCase_(caseId, user);
  });
}

function deleteCase(caseId) {
  return executeServerAction_(function(user) {
    return deleteCase_(caseId, user);
  });
}

function saveCase(request) {
  return executeServerAction_(function(user) {
    return saveCase_(request, user);
  });
}

function createReferenceCase() {
  return executeServerAction_(function(user) {
    return createCase_(createReferenceCaseRequest_(), user);
  });
}

function createPublicDemoCase() {
  return executeServerAction_(function(user) {
    return createCase_(createPublicDemoCaseRequest_(), user);
  });
}

function executeServerAction_(action) {
  try {
    var user = requireCurrentUser_();
    return success_(action(user));
  } catch (error) {
    return failure_(error);
  }
}
