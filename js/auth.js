(function () {
  const pathname = window.location.pathname;
  const isHome = pathname.endsWith('/index.html') || pathname.endsWith('/');
  const pageRoute = (file) => isHome ? 'pages/' + file : file;
  const homeRoute = isHome ? 'index.html' : '../index.html';
  const loginRoute = pageRoute('login.html');
  const protectedPages = new Set([
    '/pages/cart.html',
    '/pages/wishlist.html',
    '/pages/my-bookings.html',
    '/pages/host-a-trip.html',
    '/pages/settings.html',
    '/pages/booking.html',
    '/pages/booking-confirmation.html'
  ]);

  const isLoggedIn = () => localStorage.getItem('loggedIn') === 'true';
  const readCount = (key) => {
    try {
      const items = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(items) ? items.length : 0;
    } catch {
      return 0;
    }
  };

  function showAuthToast(message) {
    let toast = document.getElementById('hp-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hp-toast';
      toast.className = 'hp-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showAuthToast.timeout);
    showAuthToast.timeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  function requireLogin(returnTo) {
    if (isLoggedIn()) return true;
    const destination = returnTo || window.location.pathname + window.location.search + window.location.hash;
    sessionStorage.setItem('authReturnTo', destination);
    window.location.href = loginRoute + '?returnTo=' + encodeURIComponent(destination);
    return false;
  }

  window.HappynessAuth = {
    isLoggedIn,
    requireLogin,
    updateCounts: renderCounts,
    logout,
    renderHeader: () => window.HappynessHeader?.render()
  };

  function renderCounts() {
    document.querySelectorAll('[data-auth-cart-count]').forEach((badge) => {
      const count = readCount('cart');
      badge.textContent = String(count);
      badge.hidden = false;
    });
    document.querySelectorAll('[data-auth-wishlist-count]').forEach((badge) => {
      const count = readCount('wishlist');
      badge.textContent = String(count);
      badge.hidden = false;
    });
  }

  function logout() {
    document.querySelector('.hp-profile')?.removeAttribute('open');
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('happynessLoggedIn');
    window.location.href = homeRoute;
  }

  if (protectedPages.has(pathname) && !isLoggedIn()) {
    const returnTo = pathname + window.location.search + window.location.hash;
    sessionStorage.setItem('authReturnTo', returnTo);
    window.location.replace(loginRoute + '?returnTo=' + encodeURIComponent(returnTo));
  }

  document.addEventListener('click', (event) => {
    const profile = document.querySelector('.hp-profile');
    if (profile?.open && !event.target.closest('.hp-profile')) profile.open = false;
    if (event.target.closest('[data-auth-logout]')) {
      event.preventDefault();
      logout();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelector('.hp-profile')?.removeAttribute('open');
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'cart' || event.key === 'wishlist') renderCounts();
    if (event.key === 'loggedIn' || event.key === 'username') window.HappynessHeader?.render();
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.endsWith('/login.html') && window.location.hash === '#signup') {
      window.setTimeout(() => window.switchTab?.('signup'), 0);
    }
  });
})();