/**
 * User-friendly error messages utility
 * Translates technical error messages into user-friendly ones
 */

export interface FriendlyError {
  title: string;
  message: string;
  suggestion?: string;
}

/**
 * Error code to user-friendly message mapping
 */
const errorMessages: Record<string, FriendlyError> = {
  // Network errors
  ECONNREFUSED: {
    title: "Connection Failed",
    message: "Unable to connect to the server",
    suggestion: "Please check your internet connection and try again.",
  },
  ENOTFOUND: {
    title: "Server Not Found",
    message: "The server could not be reached",
    suggestion: "Please check the server URL in your settings.",
  },
  ETIMEDOUT: {
    title: "Request Timed Out",
    message: "The server took too long to respond",
    suggestion: "Please try again. If the problem persists, contact support.",
  },
  ERR_NETWORK: {
    title: "Network Error",
    message: "A network error occurred",
    suggestion: "Please check your internet connection and try again.",
  },

  // Authentication errors
  UNAUTHORIZED: {
    title: "Authentication Required",
    message: "Your session has expired",
    suggestion: "Please log in again to continue.",
  },
  INVALID_CREDENTIALS: {
    title: "Invalid Credentials",
    message: "The username or password you entered is incorrect",
    suggestion: "Please check your credentials and try again.",
  },
  TOKEN_EXPIRED: {
    title: "Session Expired",
    message: "Your login session has expired",
    suggestion: "Please log in again to continue.",
  },

  // Permission errors
  FORBIDDEN: {
    title: "Access Denied",
    message: "You don't have permission to perform this action",
    suggestion: "Contact your administrator if you need access.",
  },

  // Validation errors
  VALIDATION_ERROR: {
    title: "Invalid Input",
    message: "Some of the information you entered is invalid",
    suggestion: "Please check the form and try again.",
  },
  MISSING_FIELD: {
    title: "Required Field Missing",
    message: "Please fill in all required fields",
    suggestion: "Fields marked with * are required.",
  },

  // Resource errors
  NOT_FOUND: {
    title: "Not Found",
    message: "The requested resource could not be found",
    suggestion: "The item may have been deleted or moved.",
  },
  ALREADY_EXISTS: {
    title: "Already Exists",
    message: "A resource with this name already exists",
    suggestion: "Please use a different name.",
  },

  // Server errors
  INTERNAL_SERVER_ERROR: {
    title: "Server Error",
    message: "An unexpected error occurred on the server",
    suggestion: "Please try again later. If the problem persists, contact support.",
  },
  SERVICE_UNAVAILABLE: {
    title: "Service Unavailable",
    message: "The service is temporarily unavailable",
    suggestion: "Please try again in a few minutes.",
  },

  // Rate limiting
  TOO_MANY_REQUESTS: {
    title: "Too Many Requests",
    message: "You've made too many requests",
    suggestion: "Please wait a moment before trying again.",
  },

  // Database errors
  DATABASE_ERROR: {
    title: "Database Error",
    message: "A database error occurred",
    suggestion: "Please try again. If the problem persists, contact support.",
  },
};

/**
 * HTTP status code to error code mapping
 */
const statusCodeMap: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "ALREADY_EXISTS",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
  503: "SERVICE_UNAVAILABLE",
};

/**
 * Convert a technical error into a user-friendly message
 */
export function getFriendlyError(error: any): FriendlyError {
  // Handle null/undefined
  if (!error) {
    return {
      title: "Unknown Error",
      message: "An unexpected error occurred",
      suggestion: "Please try again.",
    };
  }

  // Check for specific error code
  if (error.code && errorMessages[error.code]) {
    return errorMessages[error.code];
  }

  // Check for HTTP status code
  if (error.status || error.response?.status) {
    const status = error.status || error.response?.status;
    const errorCode = statusCodeMap[status];
    if (errorCode && errorMessages[errorCode]) {
      return errorMessages[errorCode];
    }
  }

  // Check for error message patterns
  const message = error.message || error.toString();

  if (message.includes("ECONNREFUSED")) {
    return errorMessages.ECONNREFUSED;
  }
  if (message.includes("ENOTFOUND")) {
    return errorMessages.ENOTFOUND;
  }
  if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
    return errorMessages.ETIMEDOUT;
  }
  if (message.includes("Network Error") || message.includes("ERR_NETWORK")) {
    return errorMessages.ERR_NETWORK;
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return errorMessages.UNAUTHORIZED;
  }
  if (message.includes("Forbidden") || message.includes("403")) {
    return errorMessages.FORBIDDEN;
  }
  if (message.includes("Not Found") || message.includes("404")) {
    return errorMessages.NOT_FOUND;
  }

  // Fallback to generic error
  return {
    title: "Error",
    message: error.message || "An unexpected error occurred",
    suggestion: "Please try again. If the problem persists, contact support.",
  };
}

/**
 * Format an error for display in a toast notification
 */
export function formatErrorForToast(error: any): { title: string; description: string } {
  const friendly = getFriendlyError(error);
  return {
    title: friendly.title,
    description: friendly.suggestion || friendly.message,
  };
}
