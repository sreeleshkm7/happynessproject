(function () {
  const pathname = window.location.pathname;
  const isHome = pathname.endsWith('/index.html') || pathname.endsWith('/');
  const pageRoute = (file) => isHome ? 'pages/' + file : file;
  const homeRoute = isHome ? 'index.html' : '../index.html';
  const calendarIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path><path d="m9 16 2 2 4-4"></path></svg>';
  const profileIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"></circle><path d="M20 21a8 8 0 0 0-16 0"></path></svg>';

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function render() {
    if (!window.HappynessAuth?.isReady?.()) return;
    document.querySelectorAll('header').forEach((header) => header.remove());
    document.querySelectorAll('nav').forEach((nav) => {
      const text = nav.textContent.toLowerCase();
      if (text.includes('wishlist') && text.includes('bookings') && text.includes('host')) nav.remove();
    });

    const loggedIn = window.HappynessAuth?.isLoggedIn() === true;
    const onUpcomingEventsPage = pathname.endsWith('/upcoming-events.html');
    const user = window.HappynessAuth?.getUser();
    const userProfile = window.HappynessAuth?.getProfile();
    const role = userProfile?.role;
    const emailName = user?.email ? user.email.split('@')[0] : '';
    const username = String(userProfile?.username || user?.user_metadata?.username || emailName || 'Traveler');
    const displayName = username.trim().replace(/^./, (letter) => letter.toUpperCase());
    const firstLetter = escapeHtml(displayName.charAt(0) || 'T');
    const popup = loggedIn
      ? '<a class="hp-profile-name" href="' + pageRoute('settings.html') + '">' + escapeHtml(displayName) + '</a>' +
        '<a href="' + pageRoute('cart.html') + '">Cart <span class="hp-auth-count" data-auth-cart-count hidden>0</span></a>' +
        '<a href="' + pageRoute('wishlist.html') + '">Wishlist <span class="hp-auth-count" data-auth-wishlist-count hidden>0</span></a>' +
        '<a href="' + pageRoute('my-bookings.html') + '">My Bookings</a>' +
        '<a href="' + pageRoute('host-a-trip.html') + '">Host a Trip</a>' +
        (role === 'host' ? '<a href="' + pageRoute('host-dashboard.html') + '">Host Dashboard</a>' : '') +
        (role === 'admin' ? '<a href="' + pageRoute('admin-approvals.html') + '">Trip Approvals</a>' : '') +
        '<button class="hp-logout-button" type="button" data-auth-logout>Logout</button>'
      : '<a class="hp-login-button" href="' + pageRoute('login.html') + '">Login</a>' +
        '<a class="hp-create-account" href="' + pageRoute('login.html') + '#signup">New here? Create account</a>';

    const header = document.createElement('header');
    header.className = 'hp-site-header';
    header.innerHTML = '<div class="hp-header-inner">' +
      '<a class="hp-brand-link" href="' + homeRoute + '"><span class="hp-brand">HappynessProject</span></a>' +
      '<nav class="hp-header-actions" aria-label="Primary navigation">' +
      (loggedIn && !onUpcomingEventsPage ? '<a class="hp-icon-button hp-events-button" href="' + pageRoute('upcoming-events.html') + '" aria-label="Upcoming events" title="Upcoming events">' + calendarIcon + '</a>' : '') +
      '<details class="hp-profile"><summary class="hp-icon-button hp-profile-trigger" aria-label="Profile" title="Profile">' +
      (loggedIn ? '<span class="hp-avatar" aria-hidden="true">' + firstLetter + '</span>' : profileIcon) +
      '</summary><div class="hp-profile-menu">' + popup + '</div></details></nav></div>';
    document.body.prepend(header);
    window.HappynessAuth?.updateCounts();
  }

  window.HappynessHeader = { render };
  document.addEventListener('DOMContentLoaded', () => {
    window.HappynessAuth?.ready.then(render);
  });
  window.addEventListener('hp-auth-changed', render);
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-auth-logout]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.HappynessAuth?.logout();
    }
  });
})();