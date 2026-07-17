import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthMode = 'signup' | 'login';
type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  requireAuth: (onAuthenticated?: () => void) => boolean;
  openAuth: (mode?: AuthMode, onAuthenticated?: () => void) => void;
  signOut: () => Promise<void>;
};

type FieldErrors = Partial<
  Record<'userId' | 'password' | 'displayName' | 'form', string>
>;

const AuthContext = createContext<AuthContextValue | null>(null);
const USER_ID_PATTERN = /^[a-z0-9_]+$/;
// Supabase rejects synthetic addresses on non-resolvable/test domains.
// Use the organization's real domain while keeping the email hidden from users.
const INTERNAL_EMAIL_DOMAIN = 'biteofseattle.com';

export const normalizeUserId = (value: string) => value.trim().toLowerCase();
const internalEmail = (normalizedUserId: string) =>
  `${normalizedUserId}@${INTERNAL_EMAIL_DOMAIN}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const afterAuth = useRef<Array<() => void>>([]);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user.is_anonymous) {
        await supabase.auth.signOut();
        if (active) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession?.user.is_anonymous ? null : nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const openAuth = useCallback(
    (mode: AuthMode = 'login', onAuthenticated?: () => void) => {
      if (onAuthenticated) afterAuth.current.push(onAuthenticated);
      setAuthMode(mode);
    },
    [],
  );

  const requireAuth = useCallback(
    (onAuthenticated?: () => void) => {
      if (session?.user) {
        onAuthenticated?.();
        return true;
      }

      openAuth('login', onAuthenticated);
      return false;
    },
    [openAuth, session],
  );

  const finishAuth = useCallback(() => {
    setAuthMode(null);
    const callbacks = afterAuth.current;
    afterAuth.current = [];
    callbacks.forEach((callback) => callback());
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        requireAuth,
        openAuth,
        signOut,
      }}
    >
      {children}
      {authMode && (
        <AuthDialog
          mode={authMode}
          setMode={setAuthMode}
          close={() => {
            afterAuth.current = [];
            setAuthMode(null);
          }}
          authenticated={finishAuth}
        />
      )}
    </AuthContext.Provider>
  );
}

function AuthDialog({
  mode,
  setMode,
  close,
  authenticated,
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  close: () => void;
  authenticated: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const switchMode = (nextMode: AuthMode) => {
    setErrors({});
    setPassword('');
    setMode(nextMode);
  };

  const validate = () => {
    const nextErrors: FieldErrors = {};
    const normalized = normalizeUserId(userId);

    if (normalized.length < 4 || normalized.length > 20) {
      nextErrors.userId = 'User ID must be 4–20 characters.';
    } else if (!USER_ID_PATTERN.test(normalized)) {
      nextErrors.userId =
        'Use only lowercase letters, numbers, and underscores.';
    }

    if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    if (mode === 'signup') {
      const trimmedName = displayName.trim();
      if (trimmedName.length < 1 || trimmedName.length > 30) {
        nextErrors.displayName = 'Display name must be 1–30 characters.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});
    const normalized = normalizeUserId(userId);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: internalEmail(normalized),
          password,
          options: {
            data: {
              user_id: normalized,
              display_name: displayName.trim(),
            },
          },
        });

        if (error) throw error;
        if (!data.user || !data.session) {
          throw new Error(
            'Account confirmation must be disabled for this sign-up method.',
          );
        }

      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: internalEmail(normalized),
          password,
        });

        if (error) throw error;
      }

      authenticated();
    } catch (error) {
      const authError = error as {
        code?: string;
        message?: string;
        status?: number;
      };
      const duplicate =
        authError.code === 'user_already_exists' ||
        authError.code === '23505' ||
        authError.message?.toLowerCase().includes('already registered') ||
        authError.message?.toLowerCase().includes('duplicate');

      const rateLimited =
        authError.status === 429 ||
        authError.code === 'over_email_send_rate_limit' ||
        authError.message?.toLowerCase().includes('rate limit');

      setErrors({
        form: duplicate
          ? 'This user ID is already taken.'
          : rateLimited
            ? 'Too many sign-up attempts. Please wait before trying again.'
            : authError.message || 'Authentication failed. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const guidance =
    'This account is only for Bite of Seattle. No email is required, so please choose a user ID and password you can easily remember.';

  return (
    <div className="auth-backdrop" role="presentation">
      <section
        className="auth-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button className="auth-close" type="button" onClick={close} aria-label="Close">
          ×
        </button>
        <h1 id="auth-title">{mode === 'signup' ? 'Sign Up' : 'Log In'}</h1>
        <p className="auth-guidance">{guidance}</p>
        <form onSubmit={submit} noValidate>
          <label>
            User ID
            <input
              autoFocus
              autoComplete="username"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              aria-invalid={Boolean(errors.userId)}
            />
            {errors.userId && <span className="field-error">{errors.userId}</span>}
          </label>
          <label>
            Password
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
            {errors.password && <span className="field-error">{errors.password}</span>}
          </label>
          {mode === 'signup' && (
            <label>
              Display Name
              <input
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-invalid={Boolean(errors.displayName)}
              />
              {errors.displayName && (
                <span className="field-error">{errors.displayName}</span>
              )}
            </label>
          )}
          {errors.form && <p className="auth-form-error" role="alert">{errors.form}</p>}
          <button className="primary auth-submit" disabled={submitting}>
            {submitting
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create Account'
                : 'Log In'}
          </button>
        </form>
        <small className="recovery-warning">
          We cannot recover your account if you forget your user ID or password.
        </small>
        <p className="auth-switch">
          {mode === 'signup'
            ? 'Already have an account? '
            : 'Don’t have an account? '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
          >
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </section>
    </div>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
