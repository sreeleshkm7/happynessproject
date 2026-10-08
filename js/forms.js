(function () {
  const lastSubmitAt = new Map();
  const rateLimitMs = 30_000;

  function value(form, name) {
    return String(new FormData(form).get(name) || '').trim();
  }

  function status(form, message, success) {
    const target = form.querySelector('[data-form-status]');
    if (target) {
      target.textContent = message;
      target.hidden = false;
      target.classList.toggle('text-error', !success);
      target.classList.toggle('text-primary', success);
    }
    window.happynessToast?.(message);
  }

  function checkSpamAndRateLimit(form, key) {
    if (value(form, 'website')) throw new Error('Unable to submit this form.');
    const lastSubmission = lastSubmitAt.get(key) || 0;
    if (Date.now() - lastSubmission < rateLimitMs) {
      throw new Error('Please wait a moment before submitting this form again.');
    }
    lastSubmitAt.set(key, Date.now());
  }

  async function submit(form, key, action, successMessage) {
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    const idleText = button?.textContent || '';
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Submitting…';
    }
    try {
      checkSpamAndRateLimit(form, key);
      const result = await action();
      status(form, typeof successMessage === 'function' ? successMessage(result) : successMessage, true);
      form.reset();
    } catch (error) {
      status(form, error.message || 'We could not complete your request. Please try again.', false);
    } finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = idleText;
      }
    }
  }

  async function initializeSettings() {
    const page = document.getElementById('settings-username');
    if (!page) return;
    await window.HappynessAuth?.ready;
    const user = window.HappynessAuth?.getUser();
    const profile = window.HappynessAuth?.getProfile();
    if (!user || !profile) return;
    page.value = profile.username || '';
    document.getElementById('settings-full-name').value = profile.full_name || '';
    document.getElementById('settings-mobile').value = profile.mobile || '';
    document.getElementById('settings-email').value = user.email || '';
  }

  function initializeForms() {
    initializeSettings();

    const customTrip = document.getElementById('custom-trip-form');
    customTrip?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const start = value(customTrip, 'start_date');
      const end = value(customTrip, 'end_date');
      const minBudget = value(customTrip, 'budget_min');
      const maxBudget = value(customTrip, 'budget_max');
      if (start && end && end < start) {
        status(customTrip, 'The end date must be on or after the start date.', false);
        return;
      }
      if (minBudget && maxBudget && Number(maxBudget) < Number(minBudget)) {
        status(customTrip, 'The maximum budget must be at least the minimum budget.', false);
        return;
      }
      await submit(customTrip, 'custom-trip', async () => {
        const formData = new FormData(customTrip);
        await window.HappynessAuth?.ready;
        const user = window.HappynessAuth?.getUser();
        const id = crypto.randomUUID();
        await window.HappynessAPI.createCustomTripRequest({
          id,
          user_id: user?.id || null,
          destination_ideas: value(customTrip, 'destination_ideas'),
          dates: start || end ? `${start || 'Flexible'} to ${end || 'Flexible'}` : '',
          flexible: formData.has('flexible'),
          travellers: Number(value(customTrip, 'travellers')),
          budget_min: minBudget ? Number(minBudget) : null,
          budget_max: maxBudget ? Number(maxBudget) : null,
          interests: formData.getAll('interests').map(String),
          stay_preference: value(customTrip, 'stay_preference'),
          notes: value(customTrip, 'notes'),
          contact_name: value(customTrip, 'contact_name'),
          contact_email: value(customTrip, 'contact_email'),
          contact_mobile: value(customTrip, 'contact_mobile')
        });
        return id;
      }, (id) => `Your request has been sent. Reference ID: ${id}`);
    });

    const contact = document.getElementById('contact-form');
    contact?.addEventListener('submit', (event) => {
      event.preventDefault();
      submit(contact, 'contact', () => window.HappynessAPI.createContactMessage({
        name: value(contact, 'name'),
        email: value(contact, 'email'),
        subject: value(contact, 'subject'),
        message: value(contact, 'message')
      }), 'Your message has been sent. Our trip team will be in touch.');
    });

    const newsletter = document.getElementById('newsletter-form');
    newsletter?.addEventListener('submit', (event) => {
      event.preventDefault();
      submit(newsletter, 'newsletter', () => window.HappynessAPI.subscribeNewsletter(value(newsletter, 'email')), 'You are subscribed for trip updates.');
    });

    const profileForm = document.querySelector('[data-form-kind="profile"]');
    profileForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      submit(profileForm, 'profile', async () => {
        const user = window.HappynessAuth?.getUser();
        const profile = window.HappynessAuth?.getProfile();
        if (!user || !profile) throw new Error('Your profile is not ready. Please refresh and try again.');
        await window.HappynessAPI.updateMyProfile(user.id, {
          username: value(profileForm, 'username'),
          full_name: value(profileForm, 'full_name'),
          mobile: profile.mobile || ''
        });
        await window.HappynessAuth.refreshProfile();
      }, 'Your profile has been updated.');
    });

    const mobileForm = document.querySelector('[data-form-kind="mobile"]');
    mobileForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      submit(mobileForm, 'mobile', async () => {
        const user = window.HappynessAuth?.getUser();
        const profile = window.HappynessAuth?.getProfile();
        if (!user || !profile) throw new Error('Your profile is not ready. Please refresh and try again.');
        await window.HappynessAPI.updateMyProfile(user.id, {
          username: profile.username,
          full_name: profile.full_name,
          mobile: value(mobileForm, 'mobile')
        });
        await window.HappynessAuth.refreshProfile();
      }, 'Your mobile number has been updated. OTP verification is not configured yet.');
    });

    const emailForm = document.querySelector('[data-form-kind="email"]');
    emailForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (value(emailForm, 'email').toLowerCase() === String(window.HappynessAuth?.getUser()?.email || '').toLowerCase()) {
        status(emailForm, 'Enter a different email address.', false);
        return;
      }
      submit(emailForm, 'email', async () => {
        const email = value(emailForm, 'email');
        await window.HappynessAuth.updateAccountEmail(email);
      }, 'Check your inbox for a confirmation link to finish changing your email.');
    });

    const passwordForm = document.querySelector('[data-form-kind="password"]');
    passwordForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(passwordForm);
      if (String(formData.get('password') || '') !== String(formData.get('confirm_password') || '')) {
        status(passwordForm, 'Your passwords do not match.', false);
        return;
      }
      submit(passwordForm, 'password', async () => {
        const password = String(formData.get('password') || '');
        await window.HappynessAuth.updateAccountPassword(password);
      }, 'Your password has been updated.');
    });
  }

  document.addEventListener('DOMContentLoaded', initializeForms);
})();
