/**
 * Client-side form validation.
 *
 * The rules mirror the API contract (see backend/src/routes/auth.js) so the
 * user is told what is wrong before a request is made, and the server stays
 * the authority.
 */

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (value) => value.length >= 8 && value.length <= 72 },
  { id: 'letter', label: 'Contains a letter', test: (value) => /[a-zA-Z]/.test(value) },
  { id: 'number', label: 'Contains a number', test: (value) => /\d/.test(value) },
];

const isCityCode = (value) => /^[A-Za-z0-9-]{2,50}$/.test(value.trim());

export const validateSignIn = (values) => {
  const errors = {};

  if (!values.cityCode.trim()) errors.cityCode = 'City code is required.';
  else if (!isCityCode(values.cityCode)) errors.cityCode = 'City code may only contain letters, numbers and dashes.';

  if (!values.identifier.trim()) errors.identifier = 'Enter your operator ID, phone number or admin ID.';
  if (!values.password) errors.password = 'Password is required.';

  return errors;
};

export const validateSignUp = (values) => {
  const errors = validateSignIn(values);

  if (!values.name.trim()) errors.name = 'Full name is required.';
  else if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';

  if (!values.email.trim()) errors.email = 'Email address is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';

  if (values.password) {
    const failed = PASSWORD_RULES.filter((rule) => !rule.test(values.password));
    if (failed.length) errors.password = 'Password does not meet the requirements below.';
  }

  return errors;
};

export const hasErrors = (errors) => Object.keys(errors).length > 0;

/** The first field with an error, used to move focus after a failed submit. */
export const firstInvalidField = (errors, order) => order.find((field) => errors[field]);
