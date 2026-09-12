function success_(data) {
  return { ok: true, data: data };
}

function failure_(error) {
  var safeError = error && error.simulatorError
    ? error.simulatorError
    : {
        code: 'UNEXPECTED_ERROR',
        message: 'The request could not be completed.'
      };

  return { ok: false, error: safeError };
}

function createSimulatorError_(code, message, details) {
  var error = new Error(message);
  error.simulatorError = {
    code: code,
    message: message,
    details: details || []
  };
  return error;
}
