const successResponse = (message, data = null) => ({
  status: 'success',
  message,
  data,
});

const errorResponse = (message) => ({
  status: 'error',
  message,
});

module.exports = { successResponse, errorResponse };