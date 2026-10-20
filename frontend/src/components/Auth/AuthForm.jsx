import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import Button from '../ui/Button/Button';
import FormField from '../ui/FormField/FormField';
import Input from '../ui/Input/Input';
import Notice from '../ui/Notice/Notice';
import { apiRequest, setSession } from '../../api.js';
import { safeReturnTo } from '../../lib/routes.js';
import { ROLE_LABELS, ROLES } from '../../lib/roles.js';
import useAuthNotice from '../../lib/useAuthNotice.js';
import { PASSWORD_RULES, firstInvalidField, hasErrors, validateSignIn, validateSignUp } from '../../lib/validation.js';
import styles from './AuthForm.module.css';

const ROLE_OPTIONS = [
  {
    value: ROLES.OPERATOR,
    label: ROLE_LABELS[ROLES.OPERATOR],
    description: 'Monitors cells and approves or overrides alerts.',
  },
  {
    value: ROLES.FIELD_CREW,
    label: ROLE_LABELS[ROLES.FIELD_CREW],
    description: 'Resolves incidents in the field from a phone.',
  },
  {
    value: ROLES.ADMINISTRATOR,
    label: ROLE_LABELS[ROLES.ADMINISTRATOR],
    description: 'Configures weights, thresholds and user access.',
  },
];

const IDENTIFIER_BY_ROLE = {
  [ROLES.OPERATOR]: {
    key: 'staffId',
    label: 'Operator ID',
    type: 'text',
    hint: 'The staff ID issued by your municipality.',
  },
  [ROLES.FIELD_CREW]: {
    key: 'phone',
    label: 'Phone number',
    type: 'tel',
    hint: 'The mobile number registered for your crew.',
  },
  [ROLES.ADMINISTRATOR]: {
    key: 'adminId',
    label: 'Administrator ID',
    type: 'text',
    hint: 'The administrator ID issued to you.',
  },
};

const FIELD_ORDER = ['cityCode', 'name', 'email', 'identifier', 'password'];

const EMPTY = {
  cityCode: '',
  role: ROLES.OPERATOR,
  name: '',
  email: '',
  jurisdiction: '',
  identifier: '',
  password: '',
};

export default function AuthForm({ mode = 'signin' }) {
  const isSignUp = mode === 'signup';

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notice = useAuthNotice();
  const fieldRefs = useRef({});
  const summaryRef = useRef(null);

  const identifier = IDENTIFIER_BY_ROLE[values.role] ?? IDENTIFIER_BY_ROLE[ROLES.OPERATOR];

  const setValue = useCallback((field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  }, []);

  const validate = useCallback(
    (nextValues) => (isSignUp ? validateSignUp(nextValues) : validateSignIn(nextValues)),
    [isSignUp]
  );

  const handleBlur = useCallback(
    (field) => {
      setTouched((previous) => ({ ...previous, [field]: true }));
      const nextErrors = validate(values);
      setErrors((previous) => ({ ...previous, [field]: nextErrors[field] }));
    },
    [validate, values]
  );

  const focusField = useCallback((field) => {
    const element = fieldRefs.current[field];
    if (element && typeof element.focus === 'function') element.focus();
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setFormError(null);

      const nextErrors = validate(values);
      setErrors(nextErrors);
      setTouched(Object.fromEntries(FIELD_ORDER.map((field) => [field, true])));

      if (hasErrors(nextErrors)) {
        const first = firstInvalidField(nextErrors, FIELD_ORDER);
        if (first) focusField(first);
        return;
      }

      setSubmitting(true);

      const payload = {
        cityCode: values.cityCode.trim(),
        role: values.role,
        password: values.password,
        [identifier.key]: values.identifier.trim(),
      };

      if (isSignUp) {
        payload.name = values.name.trim();
        payload.email = values.email.trim();
        payload.jurisdiction = values.jurisdiction.trim();
      }

      try {
        const data = await apiRequest(isSignUp ? '/auth/signup' : '/auth/login', { method: 'POST', body: payload });
        setSession(data.token, data.user);

        const returnTo = safeReturnTo(searchParams.get('returnTo'));
        const role = (data.user?.role || '').toLowerCase();
        const fallback = role === 'field_crew' ? '/field' : role === 'administrator' ? '/admin' : '/operator';

        navigate(returnTo ?? fallback, { replace: true });
      } catch (error) {
        // The API message can reveal whether an account exists, so it is
        // replaced with a message that does not.
        setFormError(
          error.status === 401 || error.status === 400
            ? 'Those details did not match an account. Check them and try again.'
            : error.message || 'We could not complete that request. Please try again.'
        );
        summaryRef.current?.focus();
      } finally {
        setSubmitting(false);
      }
    },
    [focusField, identifier.key, isSignUp, navigate, searchParams, validate, values]
  );

  // When the role changes, the identifier field changes with it.
  useEffect(() => {
    setValues((previous) => ({ ...previous, identifier: '' }));
    setErrors((previous) => ({ ...previous, identifier: undefined }));
  }, [values.role]);

  const errorList = useMemo(
    () => FIELD_ORDER.filter((field) => errors[field]).map((field) => ({ field, message: errors[field] })),
    [errors]
  );

  const registerField = useCallback(
    (field) => (element) => {
      fieldRefs.current[field] = element;
    },
    []
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {notice ? (
        <Notice tone={notice.tone} title={notice.title}>
          {notice.message}
        </Notice>
      ) : null}

      {formError ? (
        <div className={styles.errorSummary} role="alert" tabIndex={-1} ref={summaryRef}>
          <p className={styles.errorSummaryTitle}>{formError}</p>
        </div>
      ) : null}

      {errorList.length ? (
        <div className={styles.errorSummary} role="alert" tabIndex={-1}>
          <p className={styles.errorSummaryTitle}>Check these fields</p>
          <ul className={styles.errorList}>
            {errorList.map((item) => (
              <li key={item.field}>
                <button type="button" className={styles.errorLink} onClick={() => focusField(item.field)}>
                  {item.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset className={styles.roleGroup}>
        <legend className={styles.legend}>Role</legend>
        <div className={styles.roleCards}>
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={styles.roleCard}
              data-selected={values.role === option.value ? 'true' : undefined}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={values.role === option.value}
                onChange={() => setValue('role', option.value)}
                className={styles.radio}
              />
              <span className={styles.roleLabel}>{option.label}</span>
              <span className={styles.roleDescription}>{option.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        label="City code"
        required
        error={touched.cityCode ? errors.cityCode : undefined}
        hint="For example CITY-IND-BPL8"
      >
        {(props) => (
          <Input
            {...props}
            ref={registerField('cityCode')}
            value={values.cityCode}
            onChange={(event) => setValue('cityCode', event.target.value)}
            onBlur={() => handleBlur('cityCode')}
            autoComplete="organization"
            autoCapitalize="characters"
            spellCheck={false}
          />
        )}
      </FormField>

      {isSignUp ? (
        <>
          <FormField label="Full name" required error={touched.name ? errors.name : undefined}>
            {(props) => (
              <Input
                {...props}
                ref={registerField('name')}
                value={values.name}
                onChange={(event) => setValue('name', event.target.value)}
                onBlur={() => handleBlur('name')}
                autoComplete="name"
              />
            )}
          </FormField>

          <FormField label="Email address" required error={touched.email ? errors.email : undefined}>
            {(props) => (
              <Input
                {...props}
                ref={registerField('email')}
                type="email"
                inputMode="email"
                value={values.email}
                onChange={(event) => setValue('email', event.target.value)}
                onBlur={() => handleBlur('email')}
                autoComplete="email"
              />
            )}
          </FormField>

          <FormField label="Municipality code" hint="Optional. Used to scope the account to one jurisdiction.">
            {(props) => (
              <Input
                {...props}
                value={values.jurisdiction}
                onChange={(event) => setValue('jurisdiction', event.target.value)}
                autoComplete="off"
              />
            )}
          </FormField>
        </>
      ) : null}

      <FormField
        label={identifier.label}
        required
        error={touched.identifier ? errors.identifier : undefined}
        hint={identifier.hint}
      >
        {(props) => (
          <Input
            {...props}
            ref={registerField('identifier')}
            type={identifier.type}
            inputMode={identifier.type === 'tel' ? 'tel' : 'text'}
            value={values.identifier}
            onChange={(event) => setValue('identifier', event.target.value)}
            onBlur={() => handleBlur('identifier')}
            autoComplete={identifier.type === 'tel' ? 'tel' : 'username'}
          />
        )}
      </FormField>

      <FormField
        label="Password"
        required
        error={touched.password ? errors.password : undefined}
        hint={isSignUp ? 'Choose a password that meets the rules below.' : undefined}
      >
        {(props) => (
          <Input
            {...props}
            ref={registerField('password')}
            reveal
            value={values.password}
            onChange={(event) => setValue('password', event.target.value)}
            onBlur={() => handleBlur('password')}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
        )}
      </FormField>

      {isSignUp ? (
        <ul className={styles.passwordRules}>
          {PASSWORD_RULES.map((rule) => {
            const passed = rule.test(values.password);
            return (
              <li key={rule.id} data-passed={passed ? 'true' : 'false'}>
                {passed ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
                {rule.label}
              </li>
            );
          })}
        </ul>
      ) : null}

      <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
        {isSignUp ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
