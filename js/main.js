(function () {
  const currentPage = window.location.pathname;
  const isHome = currentPage.endsWith('/index.html') || currentPage.endsWith('/');
  const pageRoute = (file) => isHome ? 'pages/' + file : file;
  const routes = {
    home: isHome ? 'index.html' : '../index.html',
    events: pageRoute('upcoming-events.html'),
    package: pageRoute('package-detail.html'),
    bookingDetail: pageRoute('package-detail-booking.html'),
    login: pageRoute('login.html'),
    forgot: pageRoute('forgot-password.html'),
    wishlist: pageRoute('wishlist.html'),
    bookings: pageRoute('my-bookings.html'),
    host: pageRoute('host-a-trip.html'),
    cart: pageRoute('cart.html'),
    settings: pageRoute('settings.html'),
    customize: pageRoute('customize-trip.html'),
    about: pageRoute('about.html'),
    contact: pageRoute('contact.html'),
    faq: pageRoute('faq.html'),
    terms: pageRoute('terms.html'),
    privacy: pageRoute('privacy.html'),
    cancellation: pageRoute('cancellation-policy.html'),
    safety: pageRoute('safety-guidelines.html'),
    help: pageRoute('help-center.html'),
    charters: pageRoute('group-charters.html')
  };

  const textRoute = (text) => {
    const label = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (/^happynessproject$|^home$|^explore$|^explore trips$/.test(label)) return routes.home;
    if (/upcoming events|find my happiness trip|see all|browse upcoming trips/.test(label)) return routes.events;
    if (/join trip|view details|view trip|trip details/.test(label)) return routes.package;
    if (/move to cart|^cart$|shopping cart/.test(label)) return routes.cart;
    if (/wishlist|saved trips/.test(label)) return routes.wishlist;
    if (/my bookings|^bookings$|^booking$/.test(label)) return routes.bookings;
    if (/host a trip|^host$/.test(label)) return routes.host;
    if (/customize trip|custom trip itinerary/.test(label)) return routes.customize;
    if (/about us|^about$/.test(label)) return routes.about;
    if (/contact us|^contact$/.test(label)) return routes.contact;
    if (/faq|help center|^help$/.test(label)) return routes.faq;
    if (/terms|terms of service/.test(label)) return routes.terms;
    if (/privacy/.test(label)) return routes.privacy;
    if (/cancellation|refund policy/.test(label)) return routes.cancellation;
    if (/safety/.test(label)) return routes.safety;
    if (/group charters/.test(label)) return routes.charters;
    if (/account settings|^settings$|^profile$|^sree$/.test(label)) return routes.settings;
    if (/forgot password/.test(label)) return routes.forgot;
    if (/logout|log out/.test(label)) return routes.home;
    return null;
  };

  const trips = window.HAPPINESS_TRIPS || [];
  const readStore = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const isLoggedIn = () => localStorage.getItem('loggedIn') === 'true';
  const resolveTrip = (id) => trips.find((trip) => trip.id === id);
  const pageImage = (image) => (isHome ? '' : '../') + (image.startsWith('images/') ? image : 'images/' + image);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function showToast(message) {
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
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }
  window.happynessToast = showToast;

  function setHeartState(button, saved) {
    const icon = button.querySelector('[data-icon="favorite"], .material-symbols-outlined');
    button.dataset.saved = String(saved);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', saved ? 'Remove from wishlist' : 'Add to wishlist');
    if (icon) {
      icon.style.fontVariationSettings = saved ? "'FILL' 1" : "'FILL' 0";
      icon.style.color = saved ? '#FF6B4A' : '';
    }
  }

  function updateHeartStates() {
    const ids = new Set(readStore('wishlist').map((trip) => trip.id));
    document.querySelectorAll('[data-trip-heart][data-trip-id]').forEach((button) => {
      setHeartState(button, ids.has(button.dataset.tripId));
    });
  }

  function updateWishlistBadges() {
    const count = readStore('wishlist').length;
    document.querySelectorAll('.hp-wishlist-count').forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
    const pageCount = document.getElementById('wishlist-count-badge');
    if (pageCount) pageCount.textContent = `${count} saved trip${count === 1 ? '' : 's'}`;
    window.HappynessAuth?.updateCounts();
  }

  function toggleWishlist(button) {
    const trip = resolveTrip(button.dataset.tripId);
    if (!trip) return;
    if (!isLoggedIn()) {
      sessionStorage.setItem('wishlistReturnTo', window.location.pathname + window.location.search + window.location.hash);
      sessionStorage.setItem('wishlistLoginNotice', 'true');
      showToast('Please log in to save trips');
      window.setTimeout(() => {
        window.location.href = routes.login + '?returnTo=' + encodeURIComponent(sessionStorage.getItem('wishlistReturnTo'));
      }, 500);
      return;
    }

    const wishlist = readStore('wishlist');
    const saved = wishlist.some((item) => item.id === trip.id);
    const updated = saved ? wishlist.filter((item) => item.id !== trip.id) : [...wishlist, { ...trip }];
    localStorage.setItem('wishlist', JSON.stringify(updated));
    updateHeartStates();
    updateWishlistBadges();
    if (isWishlistPage()) renderWishlist();
    showToast(saved ? 'Removed from wishlist' : 'Added to wishlist');
  }

  function isWishlistPage() {
    return currentPage.endsWith('/wishlist.html');
  }

  function isCartPage() {
    return currentPage.endsWith('/cart.html');
  }

  function cartImage(item) {
    const image = item.image || resolveTrip(item.id)?.image || '';
    if (image.startsWith('../images/')) return image;
    if (image.startsWith('images/')) return '../' + image;
    return image ? '../images/' + image.replace(/^\/+/, '') : '';
  }

  function renderCart() {
    const list = document.getElementById('cart-items');
    const empty = document.getElementById('cart-empty');
    const summary = document.getElementById('cart-summary');
    if (!list || !empty || !summary) return;

    const items = readStore('cart');
    const countLabel = document.getElementById('cart-count');
    if (countLabel) countLabel.textContent = items.length ? `(${items.length} trip${items.length === 1 ? '' : 's'})` : '';
    list.replaceChildren();

    let subtotal = 0;
    for (const item of items) {
      const trip = resolveTrip(item.id) || {};
      const title = item.title || trip.title || 'Group trip';
      const location = item.location || trip.location || '';
      const image = cartImage(item);
      const unitPrice = Number(item.price) || Number(trip.price) || 0;
      const travellers = Math.max(1, Number(item.travellers) || 1);
      subtotal += unitPrice * travellers;

      const card = document.createElement('article');
      card.className = 'hp-cart-item';
      card.dataset.cartId = item.id;
      card.innerHTML = `<a class="hp-cart-image" href="package-detail.html?id=${encodeURIComponent(item.id)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}"></a>` +
        `<div class="hp-cart-info"><a class="hp-cart-title" href="package-detail.html?id=${encodeURIComponent(item.id)}">${escapeHtml(title)}</a>` +
        `<p class="hp-cart-location">${escapeHtml(location)}</p>` +
        `<p class="hp-cart-dates">${escapeHtml(item.dates || trip.dates || '')}${(item.duration || trip.duration) ? ' · ' + escapeHtml(item.duration || trip.duration) : ''}</p>` +
        `<div class="hp-cart-controls"><div class="hp-cart-quantity" aria-label="Travellers">` +
        `<button type="button" data-cart-quantity="-1" aria-label="Remove one traveller">−</button><span>${travellers}</span><button type="button" data-cart-quantity="1" aria-label="Add one traveller">+</button>` +
        `</div><strong>₹${(unitPrice * travellers).toLocaleString('en-IN')}</strong></div>` +
        `<button class="hp-cart-row-book" type="button" data-checkout-trip-id="${escapeHtml(item.id)}">Book Now</button>` +
        `<button class="hp-cart-remove" type="button" data-cart-remove>Remove trip</button></div>`;
      card.dataset.unitPrice = String(unitPrice);
      list.append(card);
    }

    const hasItems = items.length > 0;
    empty.hidden = hasItems;
    summary.hidden = !hasItems;
    const continueLink = document.querySelector('.hp-cart-continue');
    if (continueLink) continueLink.hidden = !hasItems;
    const subtotalElement = document.getElementById('cart-subtotal');
    if (subtotalElement) subtotalElement.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    window.HappynessAuth?.updateCounts();
  }

  function cardTripId(card) {
    const text = card.textContent.toLowerCase().replace(/\s+/g, ' ');
    const matches = trips.map((trip) => ({
      id: trip.id,
      score: [trip.title, ...(trip.aliases || [])]
        .filter((title) => title && text.includes(title.toLowerCase()))
        .reduce((length, title) => Math.max(length, title.length), 0)
    })).filter((match) => match.score > 0);
    return matches.sort((left, right) => right.score - left.score)[0]?.id;
  }

  function initializeTripCards() {
    document.querySelectorAll('article').forEach((card) => {
      const id = card.dataset.tripId || cardTripId(card);
      const trip = resolveTrip(id);
      if (!trip) return;
      card.dataset.tripId = trip.id;
      card.querySelectorAll('button').forEach((button) => {
        const icon = button.querySelector('[data-icon="favorite"], .material-symbols-outlined');
        const isHeart = button.hasAttribute('onclick') && button.getAttribute('onclick').includes('toggleHeart') ||
          /wishlist/i.test(button.getAttribute('aria-label') || '') || (icon && icon.textContent.trim() === 'favorite');
        if (!isHeart) return;
        button.removeAttribute('onclick');
        button.dataset.tripHeart = 'true';
        button.dataset.tripId = trip.id;
      });
    });

    const detailHeart = document.getElementById('heart-btn');
    if (detailHeart) {
      const requestedId = new URLSearchParams(window.location.search).get('id') || 'spiti-stargazing';
      const trip = resolveTrip(requestedId) || resolveTrip('spiti-stargazing');
      if (!trip) return;
      detailHeart.dataset.tripHeart = 'true';
      detailHeart.dataset.tripId = trip.id;
      const addToCart = document.querySelector('[data-detail-add-cart]');
      if (addToCart) addToCart.dataset.tripId = trip.id;
      renderPackageDetail(trip);
    }
    updateHeartStates();
  }

  function renderPackageDetail(trip) {
    const heading = document.querySelector('h1');
    if (heading) heading.textContent = trip.title;
    const location = document.querySelector('[data-detail-location]');
    if (location) location.textContent = trip.location;
    const price = document.querySelector('[data-trip-price]');
    if (price) price.textContent = `₹${trip.price.toLocaleString('en-IN')}`;
    document.querySelectorAll('#carousel img').forEach((image) => {
      image.src = pageImage(trip.image);
      image.alt = trip.title;
    });
  }

  function renderWishlist() {
    const section = document.getElementById('wishlist-items-section');
    const empty = document.getElementById('empty-state-section');
    if (!section || !empty) return;
    const items = readStore('wishlist').map((item) => resolveTrip(item.id) || item);
    section.replaceChildren();
    for (const trip of items) {
      const card = document.createElement('article');
      card.className = 'bg-surface-container-lowest rounded-2xl p-4 custom-card-shadow transition-all duration-200 flex flex-col gap-3.5 relative';
      card.dataset.tripId = trip.id;
      card.innerHTML = `<a class="hp-wishlist-image" href="package-detail.html?id=${encodeURIComponent(trip.id)}"><img src="${escapeHtml(pageImage(trip.image))}" alt="${escapeHtml(trip.title)}"></a>` +
        `<button class="hp-wishlist-remove" type="button" data-wishlist-remove="${escapeHtml(trip.id)}" aria-label="Remove ${escapeHtml(trip.title)} from wishlist">×</button>` +
        `<div class="flex flex-wrap items-center gap-2 text-outline"><span>${escapeHtml(trip.dates)}</span><span>•</span><span>${escapeHtml(trip.duration)}</span></div>` +
        `<a class="hp-wishlist-title" href="package-detail.html?id=${encodeURIComponent(trip.id)}">${escapeHtml(trip.title)}</a>` +
        `<p class="hp-wishlist-location">${escapeHtml(trip.location)}</p>` +
        `<div class="flex items-center justify-between gap-3"><strong>₹${Number(trip.price).toLocaleString('en-IN')} <span>/person</span></strong>` +
        `<div class="flex gap-2"><button class="hp-wishlist-action" type="button" data-wishlist-remove="${escapeHtml(trip.id)}">Remove</button>` +
        `<button class="hp-wishlist-action hp-cart-action" type="button" data-move-to-cart="${escapeHtml(trip.id)}">Move to Cart</button></div></div>`;
      section.append(card);
    }
    section.classList.toggle('hidden', items.length === 0);
    empty.classList.toggle('hidden', items.length !== 0);
    const demoToggle = document.getElementById('toggle-view-btn');
    if (demoToggle) demoToggle.classList.add('hidden');
    updateWishlistBadges();
  }

  function buildNavigation() {
    document.querySelectorAll('a[href="#"]').forEach((anchor) => {
      const destination = textRoute(anchor.textContent) || textRoute(anchor.getAttribute('aria-label') || '');
      if (destination) anchor.href = destination;
    });
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      if (anchor.getAttribute('href') === '#') return;
      const target = document.getElementById(anchor.getAttribute('href').slice(1));
      if (!target) {
        const destination = textRoute(anchor.textContent);
        if (destination) anchor.href = destination;
      }
    });
    updateWishlistBadges();
    initializeTripCards();
    if (isWishlistPage()) renderWishlist();
    if (isCartPage()) renderCart();
    if (sessionStorage.getItem('wishlistLoginNotice') === 'true') {
      sessionStorage.removeItem('wishlistLoginNotice');
      showToast('Please log in to save trips');
    }
  }

  window.happynessLoginSubmit = function (event) {
    event.preventDefault();
    const username = document.getElementById('usernameInput');
    const password = document.getElementById('passwordInput');
    // Demo-only credentials; replace this check with real server-side authentication.
    if (!username || !password || username.value !== 'sree' || password.value !== '1234') {
      window.alert('Use the demo username and password shown on this page.');
      return;
    }
    localStorage.setItem('loggedIn', 'true');
    localStorage.setItem('username', username.value.trim());
    const returnTo = sessionStorage.getItem('authReturnTo') || sessionStorage.getItem('wishlistReturnTo') || new URLSearchParams(window.location.search).get('returnTo');
    sessionStorage.removeItem('authReturnTo');
    sessionStorage.removeItem('wishlistReturnTo');
    window.location.href = returnTo || routes.home;
  };

  window.toggleHeart = function (button) {
    if (button?.dataset.tripId) toggleWishlist(button);
  };

  window.removeItem = function (cardId) {
    const card = document.getElementById(cardId);
    const tripId = card?.dataset.tripId;
    if (tripId) removeWishlistTrip(tripId);
  };

  function removeWishlistTrip(id) {
    localStorage.setItem('wishlist', JSON.stringify(readStore('wishlist').filter((trip) => trip.id !== id)));
    renderWishlist();
    updateHeartStates();
    updateWishlistBadges();
    showToast('Removed from wishlist');
  }

  function addDetailToCart() {
    const button = document.querySelector('[data-detail-add-cart]');
    const trip = resolveTrip(button?.dataset.tripId);
    if (!trip) return;
    if (!isLoggedIn()) {
      window.HappynessAuth?.requireLogin();
      return;
    }
    const travellers = Number(document.getElementById('pax-count')?.textContent) || 1;
    const cart = readStore('cart');
    const item = {
      id: trip.id,
      title: trip.title,
      image: pageImage(trip.image),
      dates: trip.dates,
      travellers,
      price: trip.price
    };
    const existing = cart.findIndex((saved) => saved.id === trip.id);
    if (existing >= 0) cart[existing] = item;
    else cart.push(item);
    localStorage.setItem('cart', JSON.stringify(cart));
    window.HappynessAuth?.updateCounts();
    showToast('Added to cart');
  }

  async function shareDetail() {
    const trip = resolveTrip(document.querySelector('[data-detail-add-cart]')?.dataset.tripId);
    if (!trip) return;
    const shareData = { title: trip.title, text: trip.title, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== 'AbortError') await copyShareLink(shareData.url);
      }
      return;
    }
    await copyShareLink(shareData.url);
  }

  async function copyShareLink(url) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement('textarea');
      field.value = url;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    showToast('Link copied');
  }

  document.addEventListener('click', (event) => {
    const heart = event.target.closest('[data-trip-heart]');
    if (heart) {
      event.preventDefault();
      event.stopPropagation();
      toggleWishlist(heart);
      return;
    }
    const remove = event.target.closest('[data-wishlist-remove]');
    if (remove) {
      removeWishlistTrip(remove.dataset.wishlistRemove);
      return;
    }
    const move = event.target.closest('[data-move-to-cart]');
    if (move) {
      const id = move.dataset.moveToCart;
      const trip = resolveTrip(id) || readStore('wishlist').find((item) => item.id === id);
      if (!trip) return;
      const cart = readStore('cart');
      if (!cart.some((item) => item.id === id)) localStorage.setItem('cart', JSON.stringify([...cart, trip]));
      removeWishlistTrip(id);
      showToast('Moved to cart');
      return;
    }
    const cartRemove = event.target.closest('[data-cart-remove]');
    if (cartRemove) {
      const card = cartRemove.closest('[data-cart-id]');
      const updated = readStore('cart').filter((item) => item.id !== card?.dataset.cartId);
      localStorage.setItem('cart', JSON.stringify(updated));
      renderCart();
      showToast('Removed from cart');
      return;
    }
    const quantityButton = event.target.closest('[data-cart-quantity]');
    if (quantityButton) {
      const card = quantityButton.closest('[data-cart-id]');
      const id = card?.dataset.cartId;
      const change = Number(quantityButton.dataset.cartQuantity);
      const updated = readStore('cart').map((item) => {
        if (item.id !== id) return item;
        return { ...item, travellers: Math.max(1, (Number(item.travellers) || 1) + change) };
      });
      localStorage.setItem('cart', JSON.stringify(updated));
      renderCart();
      return;
    }
    if (event.target.closest('[data-detail-add-cart]')) {
      addDetailToCart();
      return;
    }
    if (event.target.closest('[data-detail-share]')) {
      shareDetail();
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    const card = button.closest('[data-trip-id]');
    if (card && resolveTrip(card.dataset.tripId) && textRoute(button.textContent)?.includes('package-detail')) {
      event.preventDefault();
      window.location.href = routes.package + '?id=' + encodeURIComponent(card.dataset.tripId);
      return;
    }
    const destination = textRoute(button.textContent);
    if (destination && !button.closest('form')) window.location.href = destination;
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'wishlist') {
      updateWishlistBadges();
      updateHeartStates();
      if (isWishlistPage()) renderWishlist();
    }
    if (event.key === 'cart' && isCartPage()) renderCart();
  });

  document.addEventListener('DOMContentLoaded', buildNavigation);
})();