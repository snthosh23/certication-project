const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log for developer
  console.error('Error Interceptor:', err);

  // Mongoose Bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = { message, statusCode: 404 };
  }

  // Mongoose Duplicate Key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value entered for ${field} field. Value must be unique.`;
    error = { message, statusCode: 400 };
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error = { message: 'Invalid authentication token', statusCode: 401 };
  }
  if (err.name === 'TokenExpiredError') {
    error = { message: 'Authentication token expired', statusCode: 401 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error'
  });
};

module.exports = errorHandler;
