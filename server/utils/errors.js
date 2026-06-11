export class AppError extends Error {
  constructor(message, statusCode = 500, cfComment = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
   if(cfComment)this.cfComment = cfComment;
    Error.captureStackTrace(this, this.constructor);
  }
}