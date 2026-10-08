(function () {
  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function beginCheckout(item) {
    if (!window.HappynessAuth?.isLoggedIn()) {
      window.HappynessAuth?.requireLogin('/pages/cart.html');
      return;
    }
    const trip = (window.HAPPINESS_TRIPS || []).find((entry) => entry.id === item.id) || {};
    const checkout = {
      id: item.id,
      title: item.title || trip.title || 'Group trip',
      image: item.image || trip.image || '',
      location: item.location || trip.location || '',
      dates: item.dates || trip.dates || '',
      duration: item.duration || trip.duration || '',
      price: Number(item.price) || Number(trip.price) || 0,
      quantity: Math.max(1, Number(item.travellers ?? item.quantity) || 1),
      seatsLeft: Number(item.seatsLeft) || Number(trip.seatsLeft) || 14,
      pickupPoints: item.pickupPoints || trip.pickupPoints || ['Majnu Ka Tilla, New Delhi', 'ISBT Sector 43, Chandigarh'],
      payAtPickupAllowed: item.payAtPickupAllowed ?? trip.payAtPickupAllowed ?? false
    };
    localStorage.setItem('checkout', JSON.stringify(checkout));
    window.location.href = 'booking.html';
  }

  document.addEventListener('click', (event) => {
    const selected = event.target.closest('[data-checkout-trip-id]');
    const cartButton = event.target.closest('[data-checkout-cart]');
    if (!selected && !cartButton) return;
    event.preventDefault();
    const cart = readList('cart');
    const item = selected
      ? cart.find((entry) => entry.id === selected.dataset.checkoutTripId)
      : cart[0];
    if (item) beginCheckout(item);
  });

  window.HappynessAuth?.ready.then(() => {
    if (!window.HappynessAuth.isLoggedIn()) return;
    if (window.location.pathname.endsWith('/booking.html')) initializeBookingPage();
    if (window.location.pathname.endsWith('/booking-confirmation.html')) initializeConfirmationPage();
    if (window.location.pathname.endsWith('/my-bookings.html')) initializeMyBookingsPage();
  });

  function initializeBookingPage() {
    const checkout = JSON.parse(localStorage.getItem('checkout') || 'null');
    if (!checkout) {
      window.location.replace('cart.html');
      return;
    }

    const CHILD_PRICE_PERCENT = 0.75;
    const GST_RATE = 0.05;
    const CONVENIENCE_FEE = 0;
    const ADULT_MIN = 1;
    const CHILD_MIN = 0;
    const INFANT_MIN = 0;
    const trip = (window.HAPPINESS_TRIPS || []).find((entry) => entry.id === checkout.id) || checkout;
    const adultPrice = Number(checkout.price) || 0;
    const childPrice = Math.round(adultPrice * CHILD_PRICE_PERCENT);
    const seatLimit = Math.max(1, Number(checkout.seatsLeft) || Number(trip.seatsLeft) || 14);
    let counts = { adults: Math.max(ADULT_MIN, Number(checkout.quantity) || 1), children: 0, infants: 0 };
    let couponDiscount = 0;
    let couponApplied = false;
    const touchedFields = new WeakSet();

    const form = document.getElementById('booking-form');
    const travellerForms = document.getElementById('traveller-forms');
    const payButton = document.getElementById('booking-pay-button');
    const payNowLabel = document.getElementById('booking-pay-total');
    const nameField = document.getElementById('contact-name');
    const user = window.HappynessAuth?.getUser();
    const profile = window.HappynessAuth?.getProfile();
    const username = profile?.full_name || profile?.username || user?.user_metadata?.full_name || user?.email || '';
    if (nameField) nameField.value = username;

    const image = document.getElementById('booking-trip-image');
    if (image) {
      const imagePath = checkout.image || trip.image || '';
      image.src = imagePath.startsWith('../images/') ? imagePath : '../' + (imagePath.startsWith('images/') ? imagePath : 'images/' + imagePath);
      image.alt = checkout.title;
    }
    document.getElementById('booking-trip-title').textContent = checkout.title;
    document.getElementById('booking-trip-location').textContent = checkout.location || trip.location || '';
    document.getElementById('booking-trip-dates').textContent = `${checkout.dates || trip.dates || ''} · ${checkout.duration || trip.duration || ''}`;
    const pickup = document.getElementById('pickup-point');
    document.getElementById('seat-limit').textContent = String(seatLimit);
    (checkout.pickupPoints || trip.pickupPoints || ['Majnu Ka Tilla, New Delhi', 'ISBT Sector 43, Chandigarh']).forEach((point) => {
      const option = document.createElement('option');
      option.value = point;
      option.textContent = point;
      pickup.append(option);
    });
    const payLaterCard = document.querySelector('[data-pay-later-card]');
    if (payLaterCard) payLaterCard.hidden = !(checkout.payAtPickupAllowed ?? trip.payAtPickupAllowed ?? false);

    function travellerTotal() {
      return counts.adults + counts.children + counts.infants;
    }

    function makeTravellerForm(type, index) {
      const card = document.createElement('details');
      card.className = 'booking-traveller-card';
      card.open = true;
      const label = type === 'adult' ? `Adult ${index}` : type === 'child' ? `Child ${index}` : `Infant ${index}`;
      const fields = type === 'infant'
        ? `<label>Full name<input name="${type}-${index}-name" required></label><small class="booking-error"></small><label>Date of birth<input name="${type}-${index}-dob" type="date" required></label><small class="booking-error"></small>`
        : `<div class="booking-field-grid"><label>Full name<input name="${type}-${index}-name" required></label><label>Age<input name="${type}-${index}-age" type="number" min="${type === 'adult' ? 12 : 5}" max="${type === 'adult' ? 120 : 11}" required></label></div>` +
          `<div class="booking-field-grid"><label>Gender<select name="${type}-${index}-gender" required><option value="">Select</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select></label><label>ID type<select name="${type}-${index}-id-type" required><option value="">Select</option><option>Aadhaar</option><option>Passport</option><option>Driving Licence</option><option>Voter ID</option></select></label></div>` +
          `<label>ID number<input name="${type}-${index}-id-number" required></label>`;
      card.innerHTML = `<summary>${label}</summary><div class="booking-traveller-fields">${fields}</div>`;
      if (type === 'infant') {
        const latestBirthDate = new Date();
        latestBirthDate.setFullYear(latestBirthDate.getFullYear() - 5);
        card.querySelector(`[name="${type}-${index}-dob"]`).max = latestBirthDate.toISOString().slice(0, 10);
      }
      return card;
    }

    function renderTravellerForms() {
      const previousValues = new Map([...travellerForms.querySelectorAll('input,select')]
        .map((field) => [field.name, field.value]));
      travellerForms.replaceChildren();
      const singularTypes = { adults: 'adult', children: 'child', infants: 'infant' };
      ['adults', 'children', 'infants'].forEach((type) => {
        const singular = singularTypes[type];
        for (let index = 1; index <= counts[type]; index += 1) {
          const traveller = makeTravellerForm(singular, index);
          traveller.querySelectorAll('input,select').forEach((field) => {
            if (previousValues.has(field.name)) field.value = previousValues.get(field.name);
          });
          travellerForms.append(traveller);
        }
      });
      updateValidation();
    }

    function updateCounts() {
      Object.entries(counts).forEach(([type, count]) => {
        document.querySelector(`[data-count-value="${type}"]`).textContent = String(count);
      });
      const total = travellerTotal();
      const warning = document.getElementById('seat-warning');
      warning.textContent = total > seatLimit ? `Only ${seatLimit} seats left` : '';
      warning.hidden = total <= seatLimit;
      renderTravellerForms();
      updatePrice();
    }

    function calculatePrice() {
      const subtotal = counts.adults * adultPrice + counts.children * childPrice;
      const discount = couponApplied ? couponDiscount : 0;
      const taxable = Math.max(0, subtotal - discount);
      const gst = Math.round(taxable * GST_RATE);
      const total = taxable + gst + CONVENIENCE_FEE;
      const partial = document.getElementById('reserve-partial').checked;
      const payLater = document.querySelector('input[name="payment-method"]:checked')?.value === 'pay-later';
      const paidNow = payLater ? 0 : partial ? Math.round(total * 0.25) : total;
      return { subtotal, discount, gst, total, paidNow, balance: total - paidNow };
    }

    function updatePrice() {
      const amounts = calculatePrice();
      document.getElementById('price-adults').textContent = `₹${adultPrice.toLocaleString('en-IN')}`;
      document.getElementById('price-children').textContent = `₹${childPrice.toLocaleString('en-IN')}`;
      document.querySelector('[data-price-label="adults"]').textContent = `Adults × ${counts.adults}`;
      document.querySelector('[data-price-label="children"]').textContent = `Children × ${counts.children}`;
      document.querySelector('[data-price-label="infants"]').textContent = `Infants × ${counts.infants}`;
      document.getElementById('line-adults').textContent = `₹${(counts.adults * adultPrice).toLocaleString('en-IN')}`;
      document.getElementById('line-children').textContent = `₹${(counts.children * childPrice).toLocaleString('en-IN')}`;
      document.getElementById('line-infants').textContent = '₹0';
      document.getElementById('line-subtotal').textContent = `₹${amounts.subtotal.toLocaleString('en-IN')}`;
      document.getElementById('line-discount').textContent = `−₹${amounts.discount.toLocaleString('en-IN')}`;
      document.getElementById('line-gst').textContent = `₹${amounts.gst.toLocaleString('en-IN')}`;
      document.getElementById('line-fee').textContent = `₹${CONVENIENCE_FEE.toLocaleString('en-IN')}`;
      document.getElementById('line-total').textContent = `₹${amounts.total.toLocaleString('en-IN')}`;
      document.getElementById('line-pay-now').textContent = `₹${amounts.paidNow.toLocaleString('en-IN')}`;
      document.getElementById('line-balance').textContent = `₹${amounts.balance.toLocaleString('en-IN')}`;
      payNowLabel.textContent = `₹${amounts.paidNow.toLocaleString('en-IN')}`;
      document.getElementById('sticky-pay-total').textContent = `₹${amounts.total.toLocaleString('en-IN')}`;
      document.getElementById('partial-payment-lines').hidden = !document.getElementById('reserve-partial').checked && document.querySelector('input[name="payment-method"]:checked')?.value !== 'pay-later';
      updateValidation();
    }

    function luhnValid(value) {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      let sum = 0;
      let doubleDigit = false;
      for (let index = digits.length - 1; index >= 0; index -= 1) {
        let digit = Number(digits[index]);
        if (doubleDigit) { digit *= 2; if (digit > 9) digit -= 9; }
        sum += digit;
        doubleDigit = !doubleDigit;
      }
      return sum % 10 === 0;
    }

    function selectedPaymentValid() {
      const method = document.querySelector('input[name="payment-method"]:checked')?.value;
      if (!method) return false;
      if (method === 'upi') return /^[\w.-]{2,256}@[\w.-]{2,64}$/.test(document.getElementById('upi-id').value.trim());
      if (method === 'card') {
        const expiry = document.getElementById('card-expiry').value.trim();
        const expiryMatch = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry);
        let expiryValid = false;
        if (expiryMatch) {
          const month = Number(expiryMatch[1]);
          const year = 2000 + Number(expiryMatch[2]);
          const now = new Date();
          expiryValid = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
        }
        return document.getElementById('card-name').value.trim().length > 1 &&
          luhnValid(document.getElementById('card-number').value) && expiryValid && /^\d{3,4}$/.test(document.getElementById('card-cvv').value);
      }
      if (method === 'net-banking') return Boolean(document.getElementById('bank-name').value);
      return method === 'wallet' || method === 'pay-later';
    }

    function fieldValid(field) {
      if (field.disabled || field.closest('[hidden]')) return true;
      if (field.type === 'checkbox') return field.checked;
      if (!field.value.trim()) return false;
      if (field.id === 'contact-mobile' || field.id === 'emergency-mobile') return /^\d{10}$/.test(field.value.replace(/\D/g, ''));
      if (field.id === 'contact-email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value);
      if (field.id === 'upi-id') return /^[\w.-]{2,256}@[\w.-]{2,64}$/.test(field.value.trim());
      if (field.id === 'card-number') return luhnValid(field.value);
      if (field.id === 'card-cvv') return /^\d{3,4}$/.test(field.value);
      if (field.id === 'card-expiry') {
        const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(field.value.trim());
        if (!match) return false;
        const year = 2000 + Number(match[2]);
        const month = Number(match[1]);
        const now = new Date();
        return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
      }
      return field.checkValidity();
    }

    function updateValidation() {
      if (!form) return;
      const fields = [...form.querySelectorAll('input[required],select[required],textarea[required]')];
      let valid = counts.adults >= ADULT_MIN && travellerTotal() <= seatLimit && document.getElementById('terms-agree').checked && selectedPaymentValid();
      fields.forEach((field) => {
        if (field.closest('[hidden]')) return;
        const fieldIsValid = fieldValid(field);
        if (!fieldIsValid) valid = false;
        const label = field.closest('label');
        const error = label?.querySelector('.booking-error') || field.parentElement?.nextElementSibling?.classList.contains('booking-error') && field.parentElement.nextElementSibling;
        if (error && touchedFields.has(field)) error.classList.toggle('is-visible', !fieldIsValid);
      });
      payButton.disabled = !valid;
    }

    document.querySelectorAll('[data-count-step]').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.countStep;
        const change = Number(button.dataset.change);
        const minimum = type === 'adults' ? ADULT_MIN : type === 'children' ? CHILD_MIN : INFANT_MIN;
        const next = counts[type] + change;
        if (next < minimum) return;
        if (travellerTotal() + change > seatLimit) {
          const warning = document.getElementById('seat-warning');
          warning.textContent = `Only ${seatLimit} seats left`;
          warning.hidden = false;
          return;
        }
        counts[type] = next;
        updateCounts();
      });
    });

    document.querySelectorAll('input[name="payment-method"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('[data-payment-panel]').forEach((panel) => {
          panel.hidden = panel.dataset.paymentPanel !== radio.value;
          panel.querySelectorAll('input,select').forEach((field) => { field.required = !panel.hidden && field.dataset.required === 'true'; });
        });
        updatePrice();
      });
    });
    document.getElementById('reserve-partial').addEventListener('change', updatePrice);
    form.addEventListener('input', (event) => {
      if (event.target.matches('input,select,textarea')) touchedFields.add(event.target);
      updateValidation();
    });
    form.addEventListener('change', (event) => {
      if (event.target.matches('input,select,textarea')) touchedFields.add(event.target);
      updateValidation();
    });

    document.getElementById('apply-coupon').addEventListener('click', () => {
      const message = document.getElementById('coupon-message');
      const code = document.getElementById('coupon-code').value.trim().toUpperCase();
      if (code === 'HAPPY10') {
        couponDiscount = Math.round((counts.adults * adultPrice + counts.children * childPrice) * 0.1);
        couponApplied = true;
        message.textContent = 'HAPPY10 applied: 10% off';
        message.className = 'booking-success-message';
      } else {
        couponDiscount = 0;
        couponApplied = false;
        message.textContent = 'Invalid coupon code';
        message.className = 'booking-field-error';
      }
      updatePrice();
    });

    document.getElementById('card-number').addEventListener('input', (event) => {
      const digits = event.target.value.replace(/\D/g, '').slice(0, 19);
      event.target.value = digits.replace(/(.{4})/g, '$1 ').trim();
      updateValidation();
    });
    document.getElementById('card-expiry').addEventListener('input', (event) => {
      const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
      event.target.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    });

    function collectTravellerDetails() {
      return [...travellerForms.querySelectorAll('details')].map((card) => {
        const details = {};
        card.querySelectorAll('input,select').forEach((field) => { details[field.name.split('-').slice(2).join('-')] = field.value; });
        return { type: card.querySelector('summary').textContent.split(' ')[0].toLowerCase(), ...details };
      });
    }

    function submitBooking(event) {
      event.preventDefault();
      updateValidation();
      if (payButton.disabled) {
        form.querySelector(':invalid')?.focus();
        return;
      }
      payButton.disabled = true;
      payButton.textContent = 'Processing payment...';
      const amounts = calculatePrice();
      const method = document.querySelector('input[name="payment-method"]:checked').value;
      const cardDigits = document.getElementById('card-number').value.replace(/\D/g, '');
      const payLater = method === 'pay-later';
      const partial = document.getElementById('reserve-partial').checked;
      const bookingId = `HP-${new Date().getFullYear()}-${String((JSON.parse(localStorage.getItem('bookings') || '[]').length || 0) + 1).padStart(6, '0')}`;
      const booking = {
        bookingId,
        status: payLater || partial ? 'Pending Payment' : 'Confirmed',
        trip: { ...checkout },
        travellerCounts: { ...counts },
        travellers: collectTravellerDetails(),
        primaryContact: {
          name: document.getElementById('contact-name').value.trim(),
          mobile: document.getElementById('contact-mobile').value.trim(),
          email: document.getElementById('contact-email').value.trim(),
          city: document.getElementById('contact-city').value.trim()
        },
        emergencyContact: {
          name: document.getElementById('emergency-name').value.trim(),
          relationship: document.getElementById('emergency-relationship').value.trim(),
          mobile: document.getElementById('emergency-mobile').value.trim()
        },
        pickupPoint: pickup.value,
        specialRequests: document.getElementById('special-requests').value.trim(),
        subtotal: amounts.subtotal,
        discount: amounts.discount,
        gst: amounts.gst,
        convenienceFee: CONVENIENCE_FEE,
        total: amounts.total,
        amountPaid: amounts.paidNow,
        balanceDue: amounts.balance,
        paymentMethod: { type: method, ...(method === 'card' ? { last4: cardDigits.slice(-4) } : {}) },
        bookingDate: new Date().toISOString()
      };
      window.setTimeout(() => {
        const bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
        bookings.unshift(booking);
        localStorage.setItem('bookings', JSON.stringify(bookings));
        localStorage.setItem('lastBooking', JSON.stringify(booking));
        localStorage.setItem('cart', JSON.stringify(readList('cart').filter((item) => item.id !== checkout.id)));
        localStorage.removeItem('checkout');
        window.location.href = 'booking-confirmation.html';
      }, 650);
    }

    form.addEventListener('submit', submitBooking);
    renderTravellerForms();
    updateCounts();
    document.querySelector('input[name="payment-method"][value="upi"]').dispatchEvent(new Event('change', { bubbles: true }));
  }

  function initializeConfirmationPage() {
    const requestedId = new URLSearchParams(window.location.search).get('id');
    const booking = requestedId
      ? readList('bookings').find((entry) => entry.bookingId === requestedId)
      : JSON.parse(localStorage.getItem('lastBooking') || 'null');
    if (!booking) {
      window.location.replace('my-bookings.html');
      return;
    }
    document.getElementById('confirmation-id').textContent = booking.bookingId;
    document.getElementById('confirmation-trip').textContent = booking.trip.title;
    document.getElementById('confirmation-dates').textContent = `${booking.trip.dates} · ${booking.trip.duration}`;
    document.getElementById('confirmation-counts').textContent = travellerCountLabel(booking.travellerCounts);
    document.getElementById('confirmation-paid').textContent = `₹${Number(booking.amountPaid).toLocaleString('en-IN')}`;
    document.getElementById('confirmation-status').textContent = booking.status;
    const imagePath = booking.trip.image || '';
    document.getElementById('confirmation-image').src = imagePath.startsWith('../images/') ? imagePath : '../' + imagePath;
    document.getElementById('confirmation-print').addEventListener('click', () => window.print());
    document.getElementById('confirmation-calendar').addEventListener('click', () => downloadCalendar(booking));
  }

  function travellerCountLabel(counts) {
    const label = (count, singular) => `${count} ${singular}${count === 1 ? '' : 's'}`;
    return `${label(counts.adults, 'adult')} · ${label(counts.children, 'child')} · ${label(counts.infants, 'infant')}`;
  }

  function downloadCalendar(booking) {
    let start;
    let end;
    const range = /([A-Za-z]+)\s+(\d{1,2})\s*[–-]\s*(?:([A-Za-z]+)\s*)?(\d{1,2})/.exec(booking.trip.dates || '');
    if (range) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const startMonth = monthNames.findIndex((month) => month.toLowerCase().startsWith(range[1].toLowerCase()));
      const endMonth = range[3] ? monthNames.findIndex((month) => month.toLowerCase().startsWith(range[3].toLowerCase())) : startMonth;
      let year = new Date().getFullYear();
      start = new Date(year, startMonth, Number(range[2]));
      end = new Date(year, endMonth, Number(range[4]));
      if (start < new Date(new Date().setHours(0, 0, 0, 0))) {
        year += 1;
        start = new Date(year, startMonth, Number(range[2]));
        end = new Date(year, endMonth, Number(range[4]));
      }
      end.setDate(end.getDate() + 1);
    } else {
      start = new Date();
      start.setDate(start.getDate() + 30);
      end = new Date(start);
      end.setDate(end.getDate() + 3);
    }
    const dateFormat = (date) => date.toISOString().slice(0, 10).replace(/-/g, '');
    const calendar = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:${booking.bookingId}@happynessproject\nDTSTART;VALUE=DATE:${dateFormat(start)}\nDTEND;VALUE=DATE:${dateFormat(end)}\nSUMMARY:${booking.trip.title}\nDESCRIPTION:Booking ${booking.bookingId}\nEND:VEVENT\nEND:VCALENDAR`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar' }));
    link.download = `${booking.bookingId}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function initializeMyBookingsPage() {
    const bookings = readList('bookings');
    if (!bookings.length) return;
    const main = document.querySelector('main');
    if (!main) return;
    let list = document.getElementById('checkout-bookings');
    if (!list) {
      list = document.createElement('section');
      list.id = 'checkout-bookings';
      list.className = 'checkout-bookings-list';
      main.prepend(list);
    }
    list.innerHTML = bookings.map((booking) => `<article class="checkout-booking-card" data-booking-status="${escapeHtml(booking.status)}"><div class="checkout-booking-meta"><span class="checkout-booking-status ${booking.status === 'Confirmed' ? 'is-confirmed' : 'is-pending'}">${escapeHtml(booking.status)}</span><strong>${escapeHtml(booking.bookingId)}</strong><b>₹${Number(booking.total).toLocaleString('en-IN')}</b></div><h2>${escapeHtml(booking.trip.title)}</h2><p>${escapeHtml(booking.trip.location || '')} · ${escapeHtml(booking.trip.dates)} · ${escapeHtml(booking.trip.duration)}</p><p>${travellerCountLabel(booking.travellerCounts)}</p><p>Paid ₹${Number(booking.amountPaid).toLocaleString('en-IN')} · Balance ₹${Number(booking.balanceDue).toLocaleString('en-IN')}</p><a href="booking-confirmation.html?id=${encodeURIComponent(booking.bookingId)}">View Booking</a></article>`).join('');

    const categoryButtons = document.querySelectorAll('nav[aria-label="Booking Categories"] button');
    categoryButtons.forEach((button) => {
      const label = button.querySelector('span')?.textContent.trim();
      const additional = label === 'Upcoming'
        ? bookings.filter((booking) => booking.status === 'Confirmed').length
        : label === 'Pending Payment'
          ? bookings.filter((booking) => booking.status === 'Pending Payment').length
          : 0;
      const badge = button.querySelectorAll('span')[1];
      if (badge && additional) badge.textContent = String((Number(badge.textContent) || 0) + additional);
    });
    const filterBookings = (status) => {
      list.querySelectorAll('[data-booking-status]').forEach((card) => {
        card.hidden = card.dataset.bookingStatus !== status;
      });
      categoryButtons.forEach((button) => {
        const active = (status === 'Confirmed' && button.textContent.includes('Upcoming')) ||
          (status === 'Pending Payment' && button.textContent.includes('Pending Payment'));
        button.classList.toggle('bg-primary', active);
        button.classList.toggle('text-on-primary', active);
        button.classList.toggle('shadow-sm', active);
        button.classList.toggle('bg-surface-container-high', !active);
        button.classList.toggle('text-on-surface-variant', !active);
      });
    };
    categoryButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const label = button.querySelector('span')?.textContent.trim();
        if (label === 'Upcoming') filterBookings('Confirmed');
        else if (label === 'Pending Payment') filterBookings('Pending Payment');
        else list.querySelectorAll('[data-booking-status]').forEach((card) => { card.hidden = true; });
      });
    });
    filterBookings(bookings[0].status);
  }
})();