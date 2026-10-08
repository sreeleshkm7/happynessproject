(function () {
  const currentPage = window.location.pathname;
  const isHome = currentPage.endsWith('/index.html') || currentPage.endsWith('/');
  const pageRoute = (file) => isHome ? 'pages/' + file : file;
  const routes = {
    home: isHome ? 'index.html' : '../index.html',
    events: pageRoute('upcoming-events.html'),
    package: pageRoute('package-detail.html'),
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
    if (/account settings|^settings$|^profile$/.test(label)) return routes.settings;
    if (/forgot password/.test(label)) return routes.forgot;
    if (/logout|log out/.test(label)) return routes.home;
    return null;
  };

  const tripsById = new Map();
  let wishlistIds = new Set();
  let wishlistUserId = null;
  let wishlistLoad = null;
  const isLoggedIn = () => window.HappynessAuth?.isLoggedIn() === true;
  const resolveTrip = (id) => tripsById.get(id);
  const tripLocation = (trip) => trip.location || trip.destination || '';
  const tripPrice = (trip) => Number(trip.price_per_person ?? trip.price) || 0;
  const tripImagePath = (trip) => trip.cover_image_path || trip.image || '';
  const tripDuration = (trip) => trip.duration_label || trip.duration || '';
  const tripDateLabel = (trip) => trip.date_label || trip.start_date || '';
  const pageImage = (image) => image ? window.HappynessAPI.resolveImage(image) : '';
  const formatPrice = (price) => `₹${Number(price || 0).toLocaleString('en-IN')}`;
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

  function applyHeartStates() {
    document.querySelectorAll('[data-trip-heart][data-trip-id]').forEach((button) => {
      setHeartState(button, wishlistIds.has(button.dataset.tripId));
    });
  }

  async function updateHeartStates() {
    await window.HappynessAuth?.ready;
    const user = window.HappynessAuth?.getUser();
    if (!user) {
      wishlistIds = new Set();
      wishlistUserId = null;
      wishlistLoad = null;
    } else if (wishlistUserId !== user.id) {
      wishlistUserId = user.id;
      wishlistIds = new Set();
      wishlistLoad = null;
    }
    if (user && !wishlistLoad) {
      wishlistLoad = window.HappynessAPI.getWishlistIds(user.id).then((ids) => {
        wishlistIds = new Set(ids);
      }).catch((error) => {
        wishlistLoad = null;
        throw error;
      });
    }
    try {
      if (wishlistLoad) await wishlistLoad;
    } catch (error) {
      console.error(error);
      showToast('We could not load your saved trips.');
    }
    applyHeartStates();
  }

  function saveTrips(trips) {
    trips.forEach((trip) => tripsById.set(trip.id, trip));
  }

  function updateWishlistBadges() {
    const count = wishlistIds.size;
    document.querySelectorAll('.hp-wishlist-count').forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
    const pageCount = document.getElementById('wishlist-count-badge');
    if (pageCount) pageCount.textContent = `${count} saved trip${count === 1 ? '' : 's'}`;
    window.HappynessAuth?.updateCounts();
  }

  async function toggleWishlist(button) {
    await window.HappynessAuth?.ready;
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

    const saved = wishlistIds.has(trip.id);
    if (saved) wishlistIds.delete(trip.id);
    else wishlistIds.add(trip.id);
    applyHeartStates();
    updateWishlistBadges();
    button.disabled = true;
    try {
      if (saved) await window.HappynessAPI.removeWishlistItem(window.HappynessAuth.getUser().id, trip.id);
      else await window.HappynessAPI.addWishlistItem(window.HappynessAuth.getUser().id, trip.id);
      showToast(saved ? 'Removed from wishlist' : 'Added to wishlist');
    } catch (error) {
      console.error(error);
      if (saved) wishlistIds.add(trip.id);
      else wishlistIds.delete(trip.id);
      applyHeartStates();
      if (isWishlistPage()) renderWishlist();
      showToast(error.message || 'We could not update your wishlist.');
    } finally {
      button.disabled = false;
      window.HappynessAuth?.updateCounts(true);
    }
  }

  function isWishlistPage() {
    return currentPage.endsWith('/wishlist.html');
  }

  function isCartPage() {
    return currentPage.endsWith('/cart.html');
  }

  async function renderCart() {
    const list = document.getElementById('cart-items');
    const empty = document.getElementById('cart-empty');
    const summary = document.getElementById('cart-summary');
    if (!list || !empty || !summary) return;

    const user = window.HappynessAuth?.getUser();
    if (!user) return;
    list.innerHTML = '<p class="font-body-sm text-body-sm text-on-surface-variant">Loading your cart…</p>';
    empty.hidden = true;
    summary.hidden = true;
    let items;
    try {
      items = await window.HappynessAPI.getCart(user.id);
    } catch (error) {
      console.error(error);
      list.replaceChildren();
      const message = document.createElement('p');
      message.className = 'font-body-sm text-body-sm text-on-surface-variant';
      message.textContent = error.message || 'We could not load your cart.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'hp-cart-retry';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => renderCart());
      list.append(message, retry);
      return;
    }
    const countLabel = document.getElementById('cart-count');
    if (countLabel) countLabel.textContent = items.length ? `(${items.length} trip${items.length === 1 ? '' : 's'})` : '';
    list.replaceChildren();

    let subtotal = 0;
    for (const item of items) {
      const trip = item.trip || {};
      const title = trip.title || 'Group trip';
      const location = tripLocation(trip);
      const image = pageImage(tripImagePath(trip));
      const unitPrice = tripPrice(trip);
      const travellers = Math.max(1, Number(item.travellers) || 1);
      subtotal += unitPrice * travellers;

      const card = document.createElement('article');
      card.className = 'hp-cart-item';
      card.dataset.cartId = item.trip_id;
      card.innerHTML = `<a class="hp-cart-image" href="package-detail.html?id=${encodeURIComponent(item.trip_id)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}"></a>` +
        `<div class="hp-cart-info"><a class="hp-cart-title" href="package-detail.html?id=${encodeURIComponent(item.trip_id)}">${escapeHtml(title)}</a>` +
        `<p class="hp-cart-location">${escapeHtml(location)}</p>` +
        `<p class="hp-cart-dates">${escapeHtml(tripDateLabel(trip))}${tripDuration(trip) ? ' · ' + escapeHtml(tripDuration(trip)) : ''}</p>` +
        `<div class="hp-cart-controls"><div class="hp-cart-quantity" aria-label="Travellers">` +
        `<button type="button" data-cart-quantity="-1" aria-label="Remove one traveller">−</button><span>${travellers}</span><button type="button" data-cart-quantity="1" aria-label="Add one traveller">+</button>` +
        `</div><strong>₹${(unitPrice * travellers).toLocaleString('en-IN')}</strong></div>` +
        `<button class="hp-cart-row-book" type="button" data-checkout-trip-id="${escapeHtml(item.trip_id)}">Book Now</button>` +
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

  function setCatalogStatus(container, state, message) {
    let status = container.parentElement.querySelector('[data-trip-status]');
    if (!status) {
      status = document.createElement('div');
      status.dataset.tripStatus = '';
      status.className = 'px-margin-mobile py-4 text-center font-body-sm text-body-sm text-on-surface-variant';
      container.after(status);
    }
    status.replaceChildren();
    status.hidden = state === 'ready';
    if (state === 'loading') {
      status.innerHTML = '<div class="flex gap-4 overflow-hidden"><div class="h-64 w-72 shrink-0 animate-pulse rounded-2xl bg-surface-container"></div><div class="h-64 w-72 shrink-0 animate-pulse rounded-2xl bg-surface-container"></div></div>';
    } else if (state === 'error') {
      const text = document.createElement('p');
      text.textContent = message || 'We could not load trips right now.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'mt-3 rounded-xl bg-primary px-4 py-2 text-on-primary';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => loadCatalog());
      status.append(text, retry);
    } else if (state === 'empty') {
      status.textContent = message || 'No trips match your search yet.';
    }
  }

  function cardMarkup(trip, compact) {
    const image = pageImage(tripImagePath(trip));
    const title = trip.title || 'Group trip';
    const location = tripLocation(trip);
    const description = trip.short_description || '';
    const duration = tripDuration(trip);
    const date = tripDateLabel(trip);
    const price = formatPrice(tripPrice(trip));
    const rating = Number(trip.rating || 0).toFixed(1);
    const tripId = escapeHtml(trip.id);
    if (compact) {
      return `<article class="flex-shrink-0 w-[290px] bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(15,118,110,0.06),0_2px_6px_-1px_rgba(31,41,55,0.04)] overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_30px_-4px_rgba(15,118,110,0.12)]" data-trip-id="${tripId}"><div class="relative aspect-[4/3] w-full overflow-hidden bg-surface-container"><img class="w-full h-full object-cover" src="${escapeHtml(image)}" alt="${escapeHtml(title)}"><span class="absolute top-3 left-3 px-2.5 py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full font-label-sm text-label-sm font-semibold text-primary">${escapeHtml(trip.tag || '')}</span><button type="button" aria-label="Add to wishlist" data-trip-heart data-trip-id="${tripId}" class="absolute top-3 right-3 w-10 h-10 rounded-full bg-surface-container-lowest/85 backdrop-blur-md flex items-center justify-center text-on-surface transition-transform active:scale-90"><span class="material-symbols-outlined text-xl" data-icon="favorite">favorite</span></button><div class="absolute bottom-3 left-3 right-3 flex justify-between items-center"><span class="px-2 py-0.5 rounded-lg bg-inverse-surface/80 backdrop-blur-sm text-inverse-on-surface font-label-sm text-label-sm">${escapeHtml(duration)}</span><span class="px-2 py-0.5 rounded-lg bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface font-label-sm text-label-sm font-bold">★ ${rating} (${Number(trip.review_count || 0)})</span></div></div><div class="p-4 flex-1 flex flex-col justify-between"><div><div class="text-on-surface-variant font-label-sm text-label-sm mb-1">${escapeHtml(location)}</div><h3 class="font-title-md text-title-md font-bold text-on-surface line-clamp-1">${escapeHtml(title)}</h3><p class="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">${escapeHtml(description)}</p></div><div class="mt-4 pt-3 border-t border-surface-container flex items-baseline justify-between"><div><span class="font-label-sm text-label-sm text-outline">${Number(trip.seats_left || 0)} seats left</span><div><span class="font-price-display text-price-display text-primary">${price}</span><span class="font-label-sm text-label-sm text-outline">/person</span></div></div><a class="px-3.5 py-2 bg-primary text-on-primary rounded-xl font-label-md text-label-md" href="${routes.package}?id=${encodeURIComponent(trip.id)}">Join Trip</a></div></div></article>`;
    }
    return `<article class="bg-surface-container-lowest rounded-xl overflow-hidden card-shadow transition-all duration-200 hover:-translate-y-1" data-trip-id="${tripId}"><div class="relative w-full aspect-[16/10] overflow-hidden bg-surface-container"><img class="w-full h-full object-cover" src="${escapeHtml(image)}" alt="${escapeHtml(title)}"><button type="button" aria-label="Add to wishlist" data-trip-heart data-trip-id="${tripId}" class="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/85 backdrop-blur-md flex items-center justify-center text-on-surface transition-transform active:scale-90 shadow-sm"><span class="material-symbols-outlined text-xl" data-icon="favorite">favorite</span></button><div class="absolute top-3 left-3 flex flex-wrap gap-1.5"><span class="bg-tertiary-fixed text-primary font-label-sm text-label-sm font-semibold px-2 py-0.5 rounded-lg shadow-sm">${escapeHtml(trip.tag || '')}</span><span class="bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold px-2 py-0.5 rounded-lg shadow-sm">${Number(trip.seats_left || 0)} seats left</span></div><div class="absolute bottom-2.5 left-3 bg-black/60 text-white px-2 py-0.5 rounded-md flex items-center gap-1 font-label-sm text-label-sm">★ ${rating} (${Number(trip.review_count || 0)})</div></div><div class="p-4"><div class="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm mb-1.5"><span class="font-medium">${escapeHtml(location)}</span><span>${escapeHtml(date)}</span></div><h2 class="font-title-md text-title-md text-on-surface leading-tight mb-2">${escapeHtml(title)}</h2><div class="flex items-center gap-3 text-on-surface-variant font-body-sm text-body-sm pb-3 border-b border-surface-container"><span>${escapeHtml(duration)}</span><span>•</span><span>Max ${Number(trip.max_group || 0)} travelers</span><span>•</span><span>${escapeHtml(trip.difficulty || '')}</span></div><div class="flex items-center justify-between pt-3"><div><span class="font-label-sm text-label-sm text-outline block">Total Package</span><strong class="font-price-display text-price-display text-primary">${price}</strong><span class="font-label-sm text-label-sm text-outline">/person</span></div><a class="h-11 px-5 rounded-xl bg-secondary-container text-white font-label-lg text-label-lg shadow-sm inline-flex items-center" href="${routes.package}?id=${encodeURIComponent(trip.id)}">View Details</a></div></div></article>`;
  }

  function eventFilters() {
    const selected = document.querySelector('[data-trip-filter].is-selected');
    const filter = { text: document.getElementById('trip-search')?.value || '', upcoming: true };
    const chip = selected?.dataset.tripFilter;
    if (chip === 'weekend') filter.weekend = true;
    if (chip === 'budget') filter.maxPrice = 10000;
    if (chip === 'himalayan') filter.keyword = 'Himalaya';
    if (chip === 'beach') filter.keyword = 'Beach';
    if (chip === 'heritage') filter.keyword = 'Heritage';
    const group = document.querySelector('[data-group-filter].is-selected')?.dataset.groupFilter;
    if (group === 'small') filter.maxGroup = 14;
    if (group === 'women') filter.tag = 'Women';
    if (group === 'solo') filter.tag = 'Solo';
    const budget = document.getElementById('trip-max-budget');
    if (budget?.dataset.active === 'true') filter.maxPrice = Math.min(filter.maxPrice ?? Infinity, Number(budget.value));
    const duration = document.querySelector('[data-duration-filter].is-selected')?.dataset.durationFilter;
    if (duration) filter.duration = duration;
    const difficulty = document.querySelector('[data-difficulty-filter].is-selected')?.dataset.difficultyFilter;
    if (difficulty) filter.difficulty = difficulty;
    return filter;
  }

  let catalogPage = 1;
  let catalogFilters = {};
  let catalogSort = 'earliest';
  let catalogLoading = false;

  function updateFilterSummary() {
    const summary = document.getElementById('active-trip-filters');
    if (!summary) return;
    summary.querySelectorAll('[data-active-filter]').forEach((chip) => chip.remove());
    const labels = [];
    const chip = document.querySelector('[data-trip-filter].is-selected')?.dataset.tripFilter;
    const chipLabels = { weekend: 'This Weekend', budget: 'Under ₹10k', himalayan: 'Himalayan', beach: 'Beach & Sun', heritage: 'Heritage & Culture' };
    if (chipLabels[chip]) labels.push(chipLabels[chip]);
    const search = document.getElementById('trip-search')?.value.trim();
    if (search) labels.push(`Search: ${search}`);
    if (document.getElementById('trip-max-budget')?.dataset.active === 'true') labels.push(`Up to ${formatPrice(document.getElementById('trip-max-budget').value)}`);
    const duration = document.querySelector('[data-duration-filter].is-selected')?.textContent.trim();
    const group = document.querySelector('[data-group-filter].is-selected')?.textContent.trim();
    const difficulty = document.querySelector('[data-difficulty-filter].is-selected')?.textContent.trim();
    [duration, group, difficulty].filter(Boolean).forEach((label) => labels.push(label));
    const clear = document.getElementById('clear-trip-filters');
    labels.forEach((label) => {
      const item = document.createElement('span');
      item.dataset.activeFilter = '';
      item.className = 'inline-flex items-center gap-1 bg-surface-container px-2 py-1 rounded-lg whitespace-nowrap';
      item.textContent = label;
      summary.insertBefore(item, clear);
    });
    const count = document.getElementById('active-trip-filter-count');
    if (count) count.textContent = String(labels.length);
  }

  async function loadCatalog(append) {
    const container = document.querySelector('[data-trip-list]');
    if (!container || catalogLoading) return;
    catalogLoading = true;
    if (!append) {
      catalogPage = 1;
      container.replaceChildren();
      setCatalogStatus(container, 'loading');
    }
    const page = append ? catalogPage + 1 : 1;
    try {
      const { text, ...otherFilters } = catalogFilters;
      const result = text
        ? await window.HappynessAPI.searchTrips(text, otherFilters, catalogSort, page)
        : await window.HappynessAPI.listTrips(otherFilters, catalogSort, page);
      saveTrips(result.trips);
      if (!append) container.replaceChildren();
      result.trips.forEach((trip) => container.insertAdjacentHTML('beforeend', cardMarkup(trip, container.dataset.tripList === 'home')));
      catalogPage = page;
      setCatalogStatus(container, result.trips.length ? 'ready' : 'empty');
      updateHeartStates();
      const loadMore = document.getElementById('loadMoreTrips');
      if (loadMore) {
        loadMore.hidden = result.trips.length < result.pageSize || catalogPage * result.pageSize >= result.total;
        loadMore.style.display = loadMore.hidden ? 'none' : 'flex';
      }
    } catch (error) {
      console.error(error);
      setCatalogStatus(container, 'error', 'Trips could not be loaded. Please try again.');
    } finally {
      catalogLoading = false;
    }
  }

  function initializeCatalogControls() {
    if (!document.querySelector('[data-trip-list="events"]')) return;
    document.querySelectorAll('[data-trip-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('[data-trip-filter]').forEach((chip) => {
          chip.classList.remove('is-selected', 'bg-primary', 'text-on-primary');
          chip.classList.add('bg-tertiary-fixed/60', 'text-primary');
        });
        button.classList.remove('bg-tertiary-fixed/60', 'text-primary');
        button.classList.add('is-selected', 'bg-primary', 'text-on-primary');
        catalogFilters = eventFilters();
        updateFilterSummary();
        loadCatalog(false);
      });
    });
    const search = document.getElementById('trip-search');
    let searchTimer;
    search?.addEventListener('input', () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        catalogFilters = eventFilters();
        updateFilterSummary();
        loadCatalog(false);
      }, 250);
    });
    document.getElementById('trip-sort')?.addEventListener('change', (event) => {
      catalogSort = event.target.value;
      loadCatalog(false);
    });
    const budget = document.getElementById('trip-max-budget');
    budget?.addEventListener('input', () => {
      const value = document.querySelector('[data-budget-value]');
      if (value) value.textContent = formatPrice(budget.value);
    });
    document.querySelectorAll('[data-duration-filter], [data-difficulty-filter], [data-group-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const group = button.hasAttribute('data-duration-filter') ? '[data-duration-filter]' :
          button.hasAttribute('data-difficulty-filter') ? '[data-difficulty-filter]' : '[data-group-filter]';
        document.querySelectorAll(group).forEach((choice) => {
          choice.classList.remove('is-selected', 'bg-primary', 'text-on-primary');
          choice.classList.add('bg-surface-container', 'text-on-surface');
        });
        button.classList.add('is-selected', 'bg-primary', 'text-on-primary');
        button.classList.remove('bg-surface-container', 'text-on-surface');
      });
    });
    document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
      if (budget) budget.dataset.active = 'true';
      catalogFilters = eventFilters();
      updateFilterSummary();
      loadCatalog(false);
    });
    document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
      if (budget) {
        budget.value = '25000';
        budget.dataset.active = 'false';
      }
      document.querySelectorAll('[data-duration-filter], [data-difficulty-filter], [data-group-filter]').forEach((button) => {
        button.classList.remove('is-selected', 'bg-primary', 'text-on-primary');
        button.classList.add('bg-surface-container', 'text-on-surface');
      });
      const value = document.querySelector('[data-budget-value]');
      if (value && budget) value.textContent = formatPrice(budget.value);
      document.querySelector('[data-trip-filter="all"]')?.click();
    });
    document.getElementById('clear-trip-filters')?.addEventListener('click', () => {
      if (search) search.value = '';
      if (budget) {
        budget.value = '25000';
        budget.dataset.active = 'false';
      }
      const value = document.querySelector('[data-budget-value]');
      if (value && budget) value.textContent = formatPrice(budget.value);
      document.querySelectorAll('[data-duration-filter], [data-difficulty-filter], [data-group-filter]').forEach((button) => {
        button.classList.remove('is-selected', 'bg-primary', 'text-on-primary');
        button.classList.add('bg-surface-container', 'text-on-surface');
      });
      document.querySelector('[data-trip-filter="all"]')?.click();
    });
    document.getElementById('loadMoreTrips')?.addEventListener('click', () => loadCatalog(true));
  }

  async function initializeTripCards() {
    document.querySelectorAll('[data-trip-list]').forEach((container) => {
      container.replaceChildren();
    });
    initializeCatalogControls();
    if (document.querySelector('[data-trip-list="events"]')) {
      catalogFilters = eventFilters();
      updateFilterSummary();
      await loadCatalog(false);
    } else if (document.querySelector('[data-trip-list="home"]')) {
      catalogFilters = { upcoming: true };
      await loadCatalog(false);
    }
    const detailHeart = document.getElementById('heart-btn');
    if (detailHeart) {
      showTripDetailStatus('Loading trip details…', false);
      const params = new URLSearchParams(window.location.search);
      const tripKey = params.get('id') || params.get('slug');
      if (!tripKey) {
        showTripDetailError('Choose a trip from the catalogue to view its details.');
        return;
      }
      try {
        const trip = await window.HappynessAPI.getTrip(tripKey);
        if (!trip) {
          showTripDetailError('This trip is not available.');
          return;
        }
        saveTrips([trip]);
        detailHeart.dataset.tripHeart = 'true';
        detailHeart.dataset.tripId = trip.id;
        const addToCart = document.querySelector('[data-detail-add-cart]');
        if (addToCart) addToCart.dataset.tripId = trip.id;
        renderPackageDetail(trip);
        document.querySelector('[data-trip-detail-status]')?.remove();
        updateHeartStates();
      } catch (error) {
        console.error(error);
        showTripDetailError('Trip details could not be loaded. Please try again.');
      }
    }
  }

  function showTripDetailError(message) {
    showTripDetailStatus(message, true);
  }

  function showTripDetailStatus(message, retry) {
    const main = document.querySelector('.hp-detail-content');
    if (!main) return;
    let status = main.querySelector('[data-trip-detail-status]');
    if (!status) {
      status = document.createElement('div');
      status.dataset.tripDetailStatus = '';
      status.className = 'my-6 rounded-xl bg-surface-container-low p-4 text-center text-on-surface-variant';
      main.prepend(status);
    }
    status.replaceChildren();
    const text = document.createElement('p');
    text.textContent = message;
    status.append(text);
    if (retry) {
      const retryButton = document.createElement('button');
      retryButton.type = 'button';
      retryButton.className = 'mt-3 rounded-xl bg-primary px-4 py-2 text-on-primary';
      retryButton.textContent = 'Retry';
      retryButton.addEventListener('click', () => initializeTripCards());
      status.append(retryButton);
    }
  }

  function setText(selector, value, root) {
    const element = (root || document).querySelector(selector);
    if (element) element.textContent = value == null || value === '' ? '—' : String(value);
    return element;
  }

  function renderPackageDetail(trip) {
    document.title = `${trip.title} | HappynessProject`;
    const heading = document.querySelector('h1');
    if (heading) heading.textContent = trip.title;
    setText('[data-detail-location]', trip.location || trip.destination);
    setText('[data-detail-description]', trip.description || trip.short_description);
    setText('[data-detail-short-description]', trip.short_description);
    setText('[data-detail-title]', trip.title);
    setText('[data-detail-destination]', trip.destination);
    setText('[data-detail-tag]', trip.tag);
    setText('[data-detail-difficulty-chip]', trip.difficulty);
    setText('[data-detail-rating]', Number(trip.rating || 0).toFixed(1));
    setText('[data-detail-review-count]', `(${Number(trip.review_count || 0)} reviews)`);
    setText('[data-detail-duration]', tripDuration(trip));
    setText('[data-detail-difficulty]', trip.difficulty);
    setText('[data-detail-group]', `Small Group (Max ${Number(trip.max_group || 0)})`);
    setText('[data-detail-pickup-summary]', (trip.pickup_points || []).map((point) => point.name).join(' / '));
    setText('[data-detail-seats]', `${Number(trip.seats_left || 0)} seats left`);
    setText('[data-trip-price]', formatPrice(tripPrice(trip)));
    const hostName = trip.host?.display_name || 'Trip host';
    setText('[data-detail-host-name]', hostName);
    setText('[data-detail-host-bio]', trip.host?.bio || trip.host?.company || '');
    const hostImage = document.querySelector('[data-detail-host-image]');
    if (hostImage && trip.host?.avatar_path) {
      hostImage.src = window.HappynessAPI.resolveImage(trip.host.avatar_path);
      hostImage.alt = hostName;
    }

    const carousel = document.getElementById('carousel');
    const gallery = [trip.cover_image_path, ...(trip.images || []).map((image) => image.path)].filter(Boolean);
    carousel?.replaceChildren();
    gallery.forEach((path) => {
      const frame = document.createElement('div');
      frame.className = 'snap-center shrink-0 w-full h-full relative overflow-hidden rounded-2xl bg-surface-container';
      const image = document.createElement('img');
      image.className = 'w-full h-full object-cover';
      image.src = window.HappynessAPI.resolveImage(path);
      image.alt = trip.title;
      frame.append(image);
      carousel?.append(frame);
    });
    if (!gallery.length) setEmpty('carousel', 'Photos have not been added yet.');
    const indicators = document.querySelector('[data-carousel-indicators]');
    indicators?.replaceChildren();
    gallery.forEach((_, index) => {
      const dot = document.createElement('span');
      dot.className = `indicator-dot h-1.5 rounded-full transition-all ${index === 0 ? 'w-5 bg-primary' : 'w-1.5 bg-outline-variant'}`;
      indicators?.append(dot);
    });

    const itinerary = document.getElementById('trip-itinerary');
    itinerary?.replaceChildren();
    (trip.itinerary || []).forEach((day) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'relative group itinerary-card';
      const item = document.createElement('details');
      item.className = 'bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container-high transition-all';
      const summary = document.createElement('summary');
      summary.className = 'flex justify-between items-center cursor-pointer list-none';
      const dayNumber = document.createElement('span');
      dayNumber.className = 'text-label-sm text-primary font-bold tracking-wide';
      dayNumber.textContent = `DAY ${day.day_number}`;
      const title = document.createElement('h3');
      title.className = 'font-title-md text-title-md text-on-surface font-semibold';
      title.textContent = day.title;
      const titleGroup = document.createElement('div');
      titleGroup.append(dayNumber, title);
      summary.append(titleGroup);
      const arrow = document.createElement('span');
      arrow.className = 'material-symbols-outlined text-outline-variant';
      arrow.textContent = 'expand_more';
      summary.append(arrow);
      const description = document.createElement('p');
      description.className = 'pt-3 font-body-sm text-body-sm text-on-surface-variant border-t border-surface-container-low mt-3';
      description.textContent = day.description;
      item.append(summary, description);
      wrapper.append(item);
      itinerary?.append(wrapper);
    });
    if (!trip.itinerary?.length) setEmpty('trip-itinerary', 'An itinerary has not been added yet.');

    for (const kind of ['included', 'excluded']) {
      const list = document.querySelector(`[data-inclusion-list="${kind}"]`);
      list?.replaceChildren();
      const entries = (trip.inclusions || []).filter((entry) => entry.kind === kind);
      entries.forEach((entry) => {
        const card = document.createElement('div');
        card.className = 'p-3 bg-surface-container-lowest rounded-xl flex items-start gap-3 border border-surface-container';
        const title = document.createElement('div');
        title.className = 'font-label-lg text-label-lg text-on-surface font-semibold';
        title.textContent = entry.title;
        const description = document.createElement('div');
        description.className = 'font-body-sm text-body-sm text-on-surface-variant';
        description.textContent = entry.text;
        card.append(title, description);
        list?.append(card);
      });
      if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'font-body-sm text-body-sm text-on-surface-variant';
        empty.textContent = `No ${kind} details have been added yet.`;
        list?.append(empty);
      }
      setText(`[data-inclusion-count="${kind}"]`, `${kind === 'included' ? 'Included' : 'Excluded'} (${entries.length} items)`);
    }

    const pickups = document.getElementById('trip-pickups');
    pickups?.replaceChildren();
    (trip.pickup_points || []).forEach((point, index) => {
      const card = document.createElement('div');
      card.className = 'p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-sm';
      const name = document.createElement('h3');
      name.className = 'font-title-md text-title-md text-on-surface font-semibold';
      name.textContent = point.name;
      const address = document.createElement('p');
      address.className = 'mt-2 font-body-sm text-body-sm text-on-surface-variant';
      address.textContent = point.address || '';
      const time = document.createElement('p');
      time.className = 'mt-2 text-label-sm text-primary font-medium';
      time.textContent = point.reporting_time || '';
      const hub = document.createElement('span');
      hub.className = 'px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold';
      hub.textContent = `Hub ${index + 1}`;
      card.append(name, hub, address, time);
      pickups?.append(card);
    });
    if (!trip.pickup_points?.length) setEmpty('trip-pickups', 'Pickup points have not been added yet.');
    setText('[data-detail-cancellation]', trip.cancellation_policy);

    const reviews = document.getElementById('trip-reviews');
    reviews?.replaceChildren();
    (trip.reviews || []).forEach((review) => {
      const card = document.createElement('article');
      card.className = 'p-4 rounded-xl bg-surface-container-lowest border border-surface-container shadow-sm mb-3';
      const rating = document.createElement('strong');
      rating.className = 'text-primary';
      rating.textContent = `${review.rating}/5`;
      const comment = document.createElement('p');
      comment.className = 'mt-2 font-body-sm text-body-sm text-on-surface-variant';
      comment.textContent = review.comment;
      card.append(rating, comment);
      reviews?.append(card);
    });
    if (!trip.reviews?.length) setEmpty('trip-reviews', 'No reviews yet. Be the first to share your experience after a confirmed trip.');
    initializeReviewForm(trip);
  }

  function setEmpty(id, message) {
    const container = document.getElementById(id);
    if (!container) return;
    const empty = document.createElement('p');
    empty.className = 'font-body-sm text-body-sm text-on-surface-variant';
    empty.textContent = message;
    container.append(empty);
  }

  async function initializeReviewForm(trip) {
    const form = document.getElementById('trip-review-form');
    if (!form) return;
    await window.HappynessAuth?.ready;
    const user = window.HappynessAuth?.getUser();
    if (!user) return;
    try {
      if (await window.HappynessAPI.canReviewTrip(trip.id, user.id)) form.hidden = false;
    } catch (error) {
      console.error(error);
      showToast('We could not check review eligibility.');
    }
  }

  async function renderWishlist() {
    const section = document.getElementById('wishlist-items-section');
    const empty = document.getElementById('empty-state-section');
    if (!section || !empty) return;
    const user = window.HappynessAuth?.getUser();
    if (!user) return;
    section.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'font-body-sm text-body-sm text-on-surface-variant';
    loading.textContent = 'Loading your wishlist…';
    section.append(loading);
    let rows;
    try {
      rows = await window.HappynessAPI.getWishlist(user.id);
    } catch (error) {
      console.error(error);
      section.replaceChildren();
      const message = document.createElement('p');
      message.className = 'font-body-sm text-body-sm text-on-surface-variant';
      message.textContent = error.message || 'We could not load your wishlist.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'hp-cart-retry';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => renderWishlist());
      section.append(message, retry);
      empty.classList.add('hidden');
      return;
    }
    const items = rows.filter((row) => row.trip).map((row) => row.trip);
    wishlistIds = new Set(rows.map((row) => row.trip_id));
    applyHeartStates();
    section.replaceChildren();
    for (const trip of items) {
      saveTrips([trip]);
      const card = document.createElement('article');
      card.className = 'bg-surface-container-lowest rounded-2xl p-4 custom-card-shadow transition-all duration-200 flex flex-col gap-3.5 relative';
      card.dataset.tripId = trip.id;
      card.innerHTML = `<a class="hp-wishlist-image" href="package-detail.html?id=${encodeURIComponent(trip.id)}"><img src="${escapeHtml(pageImage(tripImagePath(trip)))}" alt="${escapeHtml(trip.title)}"></a>` +
        `<button class="hp-wishlist-remove" type="button" data-wishlist-remove="${escapeHtml(trip.id)}" aria-label="Remove ${escapeHtml(trip.title)} from wishlist">×</button>` +
        `<div class="flex flex-wrap items-center gap-2 text-outline"><span>${escapeHtml(tripDateLabel(trip))}</span><span>•</span><span>${escapeHtml(tripDuration(trip))}</span></div>` +
        `<a class="hp-wishlist-title" href="package-detail.html?id=${encodeURIComponent(trip.id)}">${escapeHtml(trip.title)}</a>` +
        `<p class="hp-wishlist-location">${escapeHtml(tripLocation(trip))}</p>` +
        `<div class="flex items-center justify-between gap-3"><strong>${formatPrice(tripPrice(trip))} <span>/person</span></strong>` +
        `<div class="flex gap-2"><button class="hp-wishlist-action" type="button" data-wishlist-remove="${escapeHtml(trip.id)}">Remove</button>` +
        `<button class="hp-wishlist-action hp-cart-action" type="button" data-move-to-cart="${escapeHtml(trip.id)}">Move to Cart</button></div></div>`;
      section.append(card);
    }
    section.classList.toggle('hidden', items.length === 0);
    empty.classList.toggle('hidden', items.length !== 0);
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
    void initializeTripCards();
    if (isWishlistPage()) renderWishlist();
    if (isCartPage()) renderCart();
    if (sessionStorage.getItem('wishlistLoginNotice') === 'true') {
      sessionStorage.removeItem('wishlistLoginNotice');
      showToast('Please log in to save trips');
    }
  }

  window.toggleHeart = function (button) {
    if (button?.dataset.tripId) toggleWishlist(button);
  };

  window.removeItem = function (cardId) {
    const card = document.getElementById(cardId);
    const tripId = card?.dataset.tripId;
    if (tripId) removeWishlistTrip(tripId);
  };

  async function removeWishlistTrip(id) {
    const user = window.HappynessAuth?.getUser();
    if (!user) return;
    wishlistIds.delete(id);
    applyHeartStates();
    updateWishlistBadges();
    try {
      await window.HappynessAPI.removeWishlistItem(user.id, id);
      showToast('Removed from wishlist');
      await renderWishlist();
      window.HappynessAuth?.updateCounts(true);
    } catch (error) {
      console.error(error);
      wishlistIds.add(id);
      applyHeartStates();
      showToast(error.message || 'We could not remove this saved trip.');
      await renderWishlist();
    }
  }

  async function addDetailToCart() {
    await window.HappynessAuth?.ready;
    const button = document.querySelector('[data-detail-add-cart]');
    const trip = resolveTrip(button?.dataset.tripId);
    if (!trip) return;
    if (!isLoggedIn()) {
      window.HappynessAuth?.requireLogin();
      return;
    }
    const travellers = Number(document.getElementById('pax-count')?.textContent) || 1;
    try {
      await window.HappynessAPI.saveCartItem(window.HappynessAuth.getUser().id, trip.id, travellers);
      window.HappynessAuth?.updateCounts(true);
      showToast('Added to cart');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'We could not add this trip to your cart.');
    }
  }

  async function moveWishlistToCart(id) {
    const user = window.HappynessAuth?.getUser();
    if (!user) return;
    const button = document.querySelector(`[data-move-to-cart="${CSS.escape(id)}"]`);
    if (button) button.disabled = true;
    try {
      await window.HappynessAPI.moveWishlistItemToCart(user.id, id, 1);
      wishlistIds.delete(id);
      applyHeartStates();
      await renderWishlist();
      window.HappynessAuth?.updateCounts(true);
      showToast('Moved to cart');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'We could not move this trip to your cart.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function changeCartItem(tripId, travellers) {
    const user = window.HappynessAuth?.getUser();
    if (!user) return;
    try {
      if (travellers === null) await window.HappynessAPI.removeCartItem(user.id, tripId);
      else await window.HappynessAPI.saveCartItem(user.id, tripId, travellers);
      await renderCart();
      window.HappynessAuth?.updateCounts(true);
      if (travellers === null) showToast('Removed from cart');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'We could not update your cart.');
    }
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
      void removeWishlistTrip(remove.dataset.wishlistRemove);
      return;
    }
    const move = event.target.closest('[data-move-to-cart]');
    if (move) {
      void moveWishlistToCart(move.dataset.moveToCart);
      return;
    }
    const cartRemove = event.target.closest('[data-cart-remove]');
    if (cartRemove) {
      const card = cartRemove.closest('[data-cart-id]');
      if (card?.dataset.cartId) void changeCartItem(card.dataset.cartId, null);
      return;
    }
    const quantityButton = event.target.closest('[data-cart-quantity]');
    if (quantityButton) {
      const card = quantityButton.closest('[data-cart-id]');
      const id = card?.dataset.cartId;
      const change = Number(quantityButton.dataset.cartQuantity);
      const current = Number(card?.querySelector('.hp-cart-quantity span')?.textContent) || 1;
      if (id) void changeCartItem(id, Math.max(1, current + change));
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

  document.addEventListener('submit', async (event) => {
    if (!event.target.matches('#trip-review-form')) return;
    event.preventDefault();
    const form = event.target;
    const tripId = document.getElementById('heart-btn')?.dataset.tripId;
    const user = window.HappynessAuth?.getUser();
    const submit = form.querySelector('button[type="submit"]');
    if (!tripId || !user) return;
    submit.disabled = true;
    try {
      const data = new FormData(form);
      await window.HappynessAPI.createReview(tripId, user.id, Number(data.get('rating')), String(data.get('comment') || '').trim());
      showToast('Thank you for your review');
      form.reset();
      form.hidden = true;
      const trip = await window.HappynessAPI.getTrip(tripId);
      if (trip) renderPackageDetail(trip);
    } catch (error) {
      console.error(error);
      showToast('Your review could not be submitted. Please try again.');
    } finally {
      submit.disabled = false;
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    window.HappynessAuth?.ready.then(buildNavigation);
  });
})();