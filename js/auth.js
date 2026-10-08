(function () {
  'use strict';

  const client = window.hpSupabase;
  const profileApi = window.HappynessAPI;
  let session = null;
  let profile = null;
  let readyResolved = false;
  let recoveryMode = new URLSearchParams(window.location.search).get('update') === '1';

  function notify(message, type) {
    if (typeof window.happynessToast === 'function') window.happynessToast(message);
  }

  function emitChange() {
    window.dispatchEvent(new CustomEvent('hp-auth-changed'));
  }

  function setSession(nextSession) {
    session = nextSession || null;
    if (!session) profile = null;
    emitChange();
  }

  async function loadProfile(user) {
    if (!user || !profileApi || typeof profileApi.getMyProfile !== 'function') {
      profile = null;
      return;
    }

    try {
      profile = await profileApi.getMyProfile(user.id);
    } catch (error) {
      profile = null;
      notify('Your profile could not be loaded. Please refresh and try again.');
    }
    emitChange();
  }

  function safeReturnTo(value) {
    if (!value || typeof value !== 'string' || value[0] !== '/' || value.startsWith('//') || value.includes('\\')) {
      return null;
    }

    try {
      const destination = new URL(value, window.location.origin);
      return destination.origin === window.location.origin ? `${destination.pathname}${destination.search}${destination.hash}` : null;
    } catch (error) {
      return null;
    }
  }

  function currentReturnTo() {
    const queryValue = new URLSearchParams(window.location.search).get('returnTo');
    return safeReturnTo(queryValue) || safeReturnTo(sessionStorage.getItem('happynessReturnTo'));
  }

  function loginUrl(returnTo) {
    const destination = new URL('login.html', window.location.href);
    const safeDestination = safeReturnTo(returnTo);
    if (safeDestination) destination.searchParams.set('returnTo', safeDestination);
    return destination.href;
  }

  function homeUrl() {
    const pathname = window.location.pathname;
    const isHomePage = pathname.endsWith('/index.html') || pathname.endsWith('/');
    return new URL(isHomePage ? 'index.html' : '../index.html', window.location.href).href;
  }

  function isProtectedPage() {
    const protectedPages = new Set([
      'cart.html',
      'wishlist.html',
      'my-bookings.html',
      'host-a-trip.html',
      'settings.html',
      'booking.html',
      'booking-confirmation.html'
    ]);
    return protectedPages.has(window.location.pathname.split('/').filter(Boolean).pop());
  }

  function showAuthMessage(message, type) {
    const target = document.getElementById('auth-message');
    if (target) {
      target.textContent = message;
      target.hidden = !message;
      target.dataset.type = type || 'error';
      target.classList.toggle('text-error', type !== 'success');
      target.classList.toggle('text-primary', type === 'success');
    }
    if (message) notify(message, type);
  }

  function updateRecoveryForm() {
    const resetForm = document.getElementById('reset-request-form');
    const updateForm = document.getElementById('password-update-form');
    if (resetForm && updateForm) {
      resetForm.hidden = recoveryMode;
      updateForm.hidden = !recoveryMode;
    }
  }

  function friendlyError(error, action) {
    const message = String(error && error.message || '').toLowerCase();
    if (message.includes('invalid login credentials')) return 'Email or password is incorrect.';
    if (message.includes('email not confirmed')) return 'Please confirm your email before signing in.';
    if (message.includes('already registered') || message.includes('user already registered')) return 'An account with this email already exists. Try signing in instead.';
    if (message.includes('password') && (message.includes('6 characters') || message.includes('at least'))) return 'Use a password with at least 6 characters.';
    if (message.includes('rate limit')) return 'Too many attempts. Please wait a few minutes and try again.';
    return action === 'login'
      ? 'We could not sign you in. Check your details and try again.'
      : 'We could not complete that request. Please try again.';
  }

  function setBusy(button, busy, idleText) {
    if (!button) return;
    if (busy) {
      button.dataset.idleText = button.textContent;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Please wait...';
    } else {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = idleText || button.dataset.idleText || button.textContent;
    }
  }

  function redirectAfterAuth() {
    const returnTo = currentReturnTo();
    sessionStorage.removeItem('happynessReturnTo');
    window.location.assign(returnTo || homeUrl());
  }

  async function requireLogin(returnTo) {
    await window.HappynessAuth.ready;
    if (window.HappynessAuth.isLoggedIn()) return true;

    const destination = safeReturnTo(returnTo) || safeReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    if (destination) sessionStorage.setItem('happynessReturnTo', destination);
    window.location.assign(loginUrl(destination));
    return false;
  }

  async function handleLogin(form) {
    if (!client) {
      showAuthMessage('Sign-in is unavailable until the Supabase project URL and anon key are configured.');
      return false;
    }
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    if (!email || !form.reportValidity()) return false;

    const button = form.querySelector('[type="submit"]');
    setBusy(button, true);
    showAuthMessage('');
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      redirectAfterAuth();
      return true;
    } catch (error) {
      showAuthMessage(friendlyError(error, 'login'));
      return false;
    } finally {
      setBusy(button, false, 'Login');
    }
  }

  async function handleSignup(form) {
    if (!client) {
      showAuthMessage('Sign-up is unavailable until the Supabase project URL and anon key are configured.');
      return false;
    }
    if (!form.reportValidity()) return false;
    const values = new FormData(form);
    const username = String(values.get('username') || '').trim();
    const fullName = String(values.get('full_name') || '').trim();
    const email = String(values.get('email') || '').trim();
    const mobile = String(values.get('mobile') || '').trim();
    const password = String(values.get('password') || '');
    const confirmation = String(values.get('confirm_password') || '');
    if (password.length < 6) {
      showAuthMessage('Use a password with at least 6 characters.');
      return false;
    }
    if (password !== confirmation) {
      showAuthMessage('Your passwords do not match.');
      return false;
    }
    if (!username || !fullName || !email || !mobile) {
      showAuthMessage('Complete all sign-up fields before continuing.');
      return false;
    }

    const button = form.querySelector('[type="submit"]');
    setBusy(button, true);
    showAuthMessage('');
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { username, full_name: fullName, mobile } }
      });
      if (error) throw error;
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        showAuthMessage('An account with this email already exists. Try signing in instead.');
        return false;
      }
      if (data.session) {
        redirectAfterAuth();
      } else {
        showAuthMessage('Account created. Check your email to confirm your address, then sign in.', 'success');
        form.reset();
        const loginTab = document.querySelector('[data-auth-tab="login"]');
        if (loginTab) loginTab.click();
      }
      return true;
    } catch (error) {
      showAuthMessage(friendlyError(error, 'signup'));
      return false;
    } finally {
      setBusy(button, false, 'Create Account');
    }
  }

  async function signInWithGoogle() {
    if (!window.HAPPINESS_SUPABASE_CONFIG || !window.HAPPINESS_SUPABASE_CONFIG.GOOGLE_OAUTH_ENABLED) {
      showAuthMessage('Google sign-in is not configured yet. Please use your email and password.');
      return false;
    }
    if (!client) {
      showAuthMessage('Sign-in is unavailable until the Supabase project URL and anon key are configured.');
      return false;
    }
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
      });
      if (error) throw error;
      return true;
    } catch (error) {
      showAuthMessage(friendlyError(error, 'login'));
      return false;
    }
  }

  async function sendPasswordReset(form) {
    if (!client) {
      showAuthMessage('Password reset is unavailable until the Supabase project URL and anon key are configured.');
      return false;
    }
    if (!form.reportValidity()) return false;
    const email = String(new FormData(form).get('email') || '').trim();
    const button = form.querySelector('[type="submit"]');
    setBusy(button, true);
    showAuthMessage('');
    try {
      const redirectTo = new URL('forgot-password.html?update=1', window.location.href).href;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      showAuthMessage('If an account exists for that email, a password reset link is on its way.', 'success');
      return true;
    } catch (error) {
      showAuthMessage(friendlyError(error, 'reset'));
      return false;
    } finally {
      setBusy(button, false, 'Send Reset Link');
    }
  }

  async function updatePassword(form) {
    if (!client) {
      showAuthMessage('Password update is unavailable until the Supabase project URL and anon key are configured.');
      return false;
    }
    if (!form.reportValidity()) return false;
    const values = new FormData(form);
    const password = String(values.get('password') || '');
    const confirmation = String(values.get('confirm_password') || '');
    if (password.length < 6) {
      showAuthMessage('Use a password with at least 6 characters.');
      return false;
    }
    if (password !== confirmation) {
      showAuthMessage('Your passwords do not match.');
      return false;
    }
    const button = form.querySelector('[type="submit"]');
    setBusy(button, true);
    showAuthMessage('');
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      recoveryMode = false;
      showAuthMessage('Your password has been updated. You can now sign in with it.', 'success');
      form.reset();
      return true;
    } catch (error) {
      showAuthMessage(friendlyError(error, 'reset'));
      return false;
    } finally {
      setBusy(button, false, 'Update Password');
    }
  }

  async function logout() {
    if (!client) {
      notify('Sign-out is unavailable until Supabase is configured.');
      return false;
    }
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      window.location.assign(homeUrl());
      return true;
    } catch (error) {
      notify('We could not sign you out. Please try again.');
      return false;
    }
  }

  async function initialize() {
    if (!client) {
      readyResolved = true;
      if (isProtectedPage()) {
        window.location.replace(loginUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`));
      }
      return;
    }

    try {
      client.auth.onAuthStateChange((event, nextSession) => {
        setSession(nextSession);
        if (event === 'PASSWORD_RECOVERY') recoveryMode = true;
        if (nextSession && nextSession.user) {
          Promise.resolve().then(() => loadProfile(nextSession.user));
        }
        updateRecoveryForm();
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      setSession(data.session);
      if (data.session && data.session.user) await loadProfile(data.session.user);
    } catch (error) {
      setSession(null);
      notify('We could not verify your sign-in. Please refresh and try again.');
    } finally {
      readyResolved = true;
      const pendingDestination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (isProtectedPage() && !session) {
        window.location.replace(loginUrl(pendingDestination));
        return;
      }
      document.documentElement.classList.remove('hp-auth-pending');
      updateRecoveryForm();
      emitChange();
    }
  }

  window.HappynessAuth = {
    ready: initialize(),
    isReady: () => readyResolved,
    isLoggedIn: () => readyResolved && Boolean(session && session.user),
    getUser: () => session && session.user || null,
    getProfile: () => profile,
    isRecoveryMode: () => recoveryMode,
    requireLogin,
    logout,
    handleLogin,
    handleSignup,
    signInWithGoogle,
    sendPasswordReset,
    updatePassword,
    updateCounts: () => {
      const getCount = (key) => {
        try {
          const value = JSON.parse(localStorage.getItem(key) || '[]');
          return Array.isArray(value) ? value.length : 0;
        } catch (error) {
          return 0;
        }
      };
      const counts = {
        cart: getCount('cart'),
        wishlist: getCount('wishlist')
      };
      document.querySelectorAll('[data-auth-cart-count]').forEach((badge) => {
        badge.textContent = String(counts.cart);
        badge.hidden = counts.cart === 0;
      });
      document.querySelectorAll('[data-auth-wishlist-count]').forEach((badge) => {
        badge.textContent = String(counts.wishlist);
        badge.hidden = counts.wishlist === 0;
      });
    }
  };
})();
