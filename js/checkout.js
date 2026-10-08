(function () {
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
    sessionStorage.setItem('happynessCheckoutSelection', JSON.stringify({
      tripId: item.trip_id,
      travellers: Math.max(1, Number(item.travellers) || 1)
    }));
    window.location.href = 'booking.html';
  }

  document.addEventListener('click', async (event) => {
    const selected = event.target.closest('[data-checkout-trip-id]');
    const cartButton = event.target.closest('[data-checkout-cart]');
    if (!selected && !cartButton) return;
    event.preventDefault();
    await window.HappynessAuth?.ready;
    const user = window.HappynessAuth?.getUser();
    if (!user) {
      window.HappynessAuth?.requireLogin('/pages/cart.html');
      return;
    }
    try {
      const cart = await window.HappynessAPI.getCart(user.id);
      const item = selected
        ? cart.find((entry) => entry.trip_id === selected.dataset.checkoutTripId)
        : cart[0];
      if (item) beginCheckout(item);
      else if (!selected) window.happynessToast?.('Your cart is empty.');
    } catch (error) {
      console.error(error);
      window.happynessToast?.(error.message || 'We could not start checkout. Please try again.');
    }
  });

  window.HappynessAuth?.ready.then(() => {
    if (!window.HappynessAuth.isLoggedIn()) return;
    if (window.location.pathname.endsWith('/booking.html')) initializeBookingPage();
    if (window.location.pathname.endsWith('/booking-confirmation.html')) initializeConfirmationPage();
    if (window.location.pathname.endsWith('/my-bookings.html')) initializeMyBookingsPage();
  });

  async function initializeBookingPage() {
    let selection;
    try {
      selection = JSON.parse(sessionStorage.getItem('happynessCheckoutSelection') || 'null');
    } catch (error) {
      console.error(error);
      selection = null;
    }
    if (!selection?.tripId) {
      window.location.replace('cart.html');
      return;
    }
    let trip;
    try {
      trip = await window.HappynessAPI.getTrip(selection.tripId);
      if (!trip) throw new Error('This trip is no longer available.');
    } catch (error) {
      console.error(error);
      window.happynessToast?.(error.message || 'We could not load this trip.');
      window.setTimeout(() => window.location.replace('cart.html'), 700);
      return;
    }
    document.getElementById('booking-load-status').hidden = true;
    const checkout = {
      id: trip.id,
      title: trip.title,
      image: window.HappynessAPI.resolveImage(trip.cover_image_path),
      location: trip.location || trip.destination || '',
      dates: trip.date_label || trip.start_date || '',
      duration: trip.duration_label || '',
      price: Number(trip.price_per_person),
      quantity: Math.max(1, Number(selection.travellers) || 1),
      seatsLeft: Number(trip.seats_left) || 0,
      pickupPoints: trip.pickup_points || [],
      payAtPickupAllowed: trip.pay_at_pickup_allowed === true
    };

    const CHILD_PRICE_PERCENT = 0.75;
    const GST_RATE = 0.05;
    const CONVENIENCE_FEE = 0;
    const ADULT_MIN = 1;
    const CHILD_MIN = 0;
    const INFANT_MIN = 0;
    const adultPrice = Number(checkout.price) || 0;
    const childPrice = Math.round(adultPrice * CHILD_PRICE_PERCENT);
    const seatLimit = Math.max(0, checkout.seatsLeft);
    let counts = { adults: Math.max(ADULT_MIN, Number(checkout.quantity) || 1), children: 0, infants: 0 };
    let couponPercent = 0;
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
      image.src = checkout.image;
      image.alt = checkout.title;
    }
    document.getElementById('booking-trip-title').textContent = checkout.title;
    document.getElementById('booking-trip-location').textContent = checkout.location;
    document.getElementById('booking-trip-dates').textContent = `${checkout.dates} · ${checkout.duration}`;
    const pickup = document.getElementById('pickup-point');
    document.getElementById('seat-limit').textContent = String(seatLimit);
    checkout.pickupPoints.forEach((point) => {
      const option = document.createElement('option');
      option.value = point.name;
      option.textContent = point.name;
      pickup.append(option);
    });
    const payLaterCard = document.querySelector('[data-pay-later-card]');
    if (payLaterCard) payLaterCard.hidden = !checkout.payAtPickupAllowed;
    if (seatLimit < 1) window.happynessToast?.('This trip is currently sold out.');

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
      const discount = couponApplied ? Math.round(subtotal * couponPercent / 100) : 0;
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

    document.getElementById('apply-coupon').addEventListener('click', async () => {
      const message = document.getElementById('coupon-message');
      const code = document.getElementById('coupon-code').value.trim().toUpperCase();
      if (!code) {
        couponPercent = 0;
        couponApplied = false;
        message.textContent = '';
        updatePrice();
        return;
      }
      const button = document.getElementById('apply-coupon');
      button.disabled = true;
      try {
        const coupon = await window.HappynessAPI.getCoupon(code);
        if (!coupon) throw new Error('Coupon is invalid or expired.');
        couponPercent = Number(coupon.percent_off);
        couponApplied = true;
        message.textContent = `${coupon.code} applied: ${couponPercent}% off`;
        message.className = 'booking-success-message';
      } catch (error) {
        console.error(error);
        couponPercent = 0;
        couponApplied = false;
        message.textContent = error.message || 'We could not verify this coupon.';
        message.className = 'booking-field-error';
      } finally {
        button.disabled = false;
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
        const type = card.querySelector('summary').textContent.split(' ')[0].toLowerCase();
        const value = (field) => card.querySelector(`[name="${type}-${card.querySelector('summary').textContent.split(' ')[1]}-${field}"]`)?.value.trim() || '';
        const traveller = { type, full_name: value('name') };
        if (type === 'infant') traveller.dob = value('dob');
        else traveller.age = Number(value('age'));
        if (type !== 'infant') {
          traveller.gender = value('gender');
          traveller.id_type = value('id-type');
          traveller.id_number = value('id-number');
        }
        return traveller;
      });
    }

    async function submitBooking(event) {
      event.preventDefault();
      updateValidation();
      if (payButton.disabled) {
        form.querySelector(':invalid')?.focus();
        return;
      }
      const originalButtonLabel = `Pay ${payNowLabel.textContent}`;
      payButton.disabled = true;
      payButton.textContent = 'Processing demo booking…';
      const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
      const paymentMethod = {
        'net-banking': 'net_banking',
        'pay-later': 'pay_later'
      }[selectedMethod] || selectedMethod;
      try {
        // Replace this demo-only flow with a payment gateway, Edge Function, and signed webhook.
        const booking = await window.HappynessAPI.createBooking({
          tripId: trip.id,
          adults: counts.adults,
          children: counts.children,
          infants: counts.infants,
          travellers: collectTravellerDetails(),
          contact: {
            name: document.getElementById('contact-name').value.trim(),
            mobile: document.getElementById('contact-mobile').value.trim(),
            email: document.getElementById('contact-email').value.trim(),
            city: document.getElementById('contact-city').value.trim(),
            emergency_name: document.getElementById('emergency-name').value.trim(),
            emergency_relation: document.getElementById('emergency-relationship').value.trim(),
            emergency_mobile: document.getElementById('emergency-mobile').value.trim(),
            special_requests: document.getElementById('special-requests').value.trim()
          },
          pickupPoint: pickup.value,
          paymentMethod,
          couponCode: couponApplied ? document.getElementById('coupon-code').value.trim().toUpperCase() : null,
          partial: document.getElementById('reserve-partial').checked
        });
        sessionStorage.removeItem('happynessCheckoutSelection');
        window.location.href = `booking-confirmation.html?id=${encodeURIComponent(booking.id)}`;
      } catch (error) {
        console.error(error);
        const message = String(error.message || '').toLowerCase();
        if (message.includes('authentication required') || message.includes('not authenticated')) {
          window.HappynessAuth?.requireLogin(`${window.location.pathname}${window.location.search}`);
        } else if (message.includes('seats no longer available')) {
          window.happynessToast?.('Those seats are no longer available. Please update your traveller count.');
        } else if (message.includes('coupon')) {
          window.happynessToast?.('That coupon is invalid or expired. Please remove it and try again.');
        } else {
          window.happynessToast?.(error.message || 'We could not create this booking. Please try again.');
        }
      } finally {
        payButton.textContent = originalButtonLabel;
        updateValidation();
      }
    }

    form.addEventListener('submit', submitBooking);
    renderTravellerForms();
    updateCounts();
    document.querySelector('input[name="payment-method"][value="upi"]').dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function initializeConfirmationPage() {
    const params = new URLSearchParams(window.location.search);
    const identifier = params.get('id') || params.get('ref');
    if (!identifier) {
      window.location.replace('my-bookings.html');
      return;
    }
    let booking;
    try {
      booking = await window.HappynessAPI.getBooking(identifier);
    } catch (error) {
      console.error(error);
      window.happynessToast?.(error.message || 'We could not load this booking.');
      window.setTimeout(() => window.location.replace('my-bookings.html'), 700);
      return;
    }
    if (!booking) {
      window.happynessToast?.('This booking was not found or is not available to your account.');
      window.setTimeout(() => window.location.replace('my-bookings.html'), 700);
      return;
    }
    document.getElementById('confirmation-load-status').hidden = true;
    const trip = booking.trip_snapshot || {};
    const dates = trip.date_label || trip.start_date || '';
    document.getElementById('confirmation-id').textContent = booking.booking_ref;
    document.getElementById('confirmation-trip').textContent = trip.title || 'Group trip';
    document.getElementById('confirmation-dates').textContent = `${dates} · ${trip.duration_label || ''}`;
    document.getElementById('confirmation-counts').textContent = travellerCountLabel(booking);
    document.getElementById('confirmation-total').textContent = formatMoney(booking.total);
    document.getElementById('confirmation-paid').textContent = formatMoney(booking.amount_paid);
    document.getElementById('confirmation-balance').textContent = formatMoney(booking.balance_due);
    document.getElementById('confirmation-status').textContent = booking.status;
    const image = document.getElementById('confirmation-image');
    if (trip.cover_image_path) image.src = window.HappynessAPI.resolveImage(trip.cover_image_path);
    image.alt = trip.title || 'Booked trip';
    document.getElementById('confirmation-print').addEventListener('click', () => window.print());
    document.getElementById('confirmation-calendar').addEventListener('click', () => downloadCalendar({
      bookingId: booking.booking_ref,
      trip: { title: trip.title || 'Group trip', dates }
    }));
  }

  function formatMoney(value) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  function travellerCountLabel(booking) {
    const label = (count, singular) => `${count} ${Number(count) === 1 ? singular : singular === 'child' ? 'children' : `${singular}s`}`;
    return `${label(booking.adults, 'adult')} · ${label(booking.children, 'child')} · ${label(booking.infants, 'infant')}`;
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
    const escapeCalendarText = (value) => String(value).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
    const calendar = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:${booking.bookingId}@happynessproject\nDTSTART;VALUE=DATE:${dateFormat(start)}\nDTEND;VALUE=DATE:${dateFormat(end)}\nSUMMARY:${escapeCalendarText(booking.trip.title)}\nDESCRIPTION:Booking ${escapeCalendarText(booking.bookingId)}\nEND:VEVENT\nEND:VCALENDAR`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar' }));
    link.download = `${booking.bookingId}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function initializeMyBookingsPage() {
    const list = document.getElementById('checkout-bookings');
    const totalCount = document.getElementById('booking-total-count');
    const categoryButtons = [...document.querySelectorAll('nav[aria-label="Booking Categories"] button')];
    if (!list) return;
    const user = window.HappynessAuth?.getUser();
    if (!user) return;
    let bookings = [];
    let selectedStatus = 'Confirmed';

    function updateCounts() {
      const counts = {
        Confirmed: bookings.filter((booking) => booking.status === 'Confirmed').length,
        'Pending Payment': bookings.filter((booking) => booking.status === 'Pending Payment').length,
        Completed: bookings.filter((booking) => booking.status === 'Completed').length,
        Cancelled: bookings.filter((booking) => booking.status === 'Cancelled').length
      };
      if (totalCount) totalCount.textContent = `${bookings.length} Trip${bookings.length === 1 ? '' : 's'} Listed`;
      categoryButtons.forEach((button) => {
        const label = button.querySelector('span')?.textContent.trim();
        const status = label === 'Upcoming' ? 'Confirmed' : label;
        const badge = button.querySelectorAll('span')[1];
        if (badge) badge.textContent = String(counts[status] || 0);
      });
    }

    function renderBookings() {
      const filtered = bookings.filter((booking) => booking.status === selectedStatus);
      list.replaceChildren();
      if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'mt-4 border-2 border-dashed border-outline-variant/60 rounded-2xl p-6 text-center bg-surface-container-lowest/50';
        const heading = document.createElement('h2');
        heading.className = 'font-title-md text-title-md text-on-surface font-semibold';
        heading.textContent = `No ${selectedStatus === 'Confirmed' ? 'upcoming' : selectedStatus.toLowerCase()} bookings`;
        const text = document.createElement('p');
        text.className = 'font-body-sm text-body-sm text-on-surface-variant mt-1';
        text.textContent = 'Your bookings will appear here once you reserve a trip.';
        const browse = document.createElement('a');
        browse.className = 'inline-flex mt-3 font-label-md text-label-md text-primary font-bold hover:underline';
        browse.href = 'upcoming-events.html';
        browse.textContent = 'Browse Upcoming Trips';
        empty.append(heading, text, browse);
        list.append(empty);
        return;
      }
      filtered.forEach((booking) => {
        const trip = booking.trip_snapshot || {};
        const dateLabel = trip.date_label || trip.start_date || '';
        const travellers = travellerCountLabel(booking);
        const statusClass = booking.status === 'Confirmed'
          ? 'bg-primary-fixed text-on-primary-fixed-variant'
          : booking.status === 'Pending Payment'
            ? 'bg-secondary-fixed text-on-secondary-fixed-variant'
            : 'bg-surface-container-high text-on-surface-variant';
        const card = document.createElement('article');
        card.className = 'bg-surface-container-lowest rounded-2xl p-4 shadow-[0_4px_20px_-2px_rgba(15,118,110,0.06),0_2px_6px_-1px_rgba(31,41,55,0.04)] border border-surface-container-high/70 transition-all duration-200';
        card.innerHTML = `<div class="flex items-center justify-between pb-3 border-b border-surface-container-low mb-3"><div class="flex items-center gap-2"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${statusClass} font-label-sm text-label-sm font-semibold">${escapeHtml(booking.status)}</span><span class="font-label-sm text-label-sm text-outline">#${escapeHtml(booking.booking_ref)}</span></div><div class="text-right"><span class="font-price-display text-price-display text-primary">${formatMoney(booking.total)}</span><span class="block font-label-sm text-label-sm text-outline">Total</span></div></div>` +
          `<div class="flex gap-3.5 mb-3"><div class="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 relative bg-surface-container-high">${trip.cover_image_path ? `<img class="w-full h-full object-cover" src="${escapeHtml(window.HappynessAPI.resolveImage(trip.cover_image_path))}" alt="${escapeHtml(trip.title || 'Booked trip')}">` : ''}</div><div class="flex-1 min-w-0"><span class="inline-flex items-center gap-1 text-[11px] font-bold text-primary tracking-wide">${escapeHtml(trip.destination || trip.location || '')}</span><h2 class="font-title-md text-title-md text-on-surface font-semibold line-clamp-2 leading-snug">${escapeHtml(trip.title || 'Group trip')}</h2><p class="mt-1 font-body-sm text-body-sm text-on-surface-variant">${escapeHtml(dateLabel)} · ${escapeHtml(trip.duration_label || '')}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${escapeHtml(travellers)}</p></div></div>` +
          `<div class="flex flex-wrap items-center justify-between gap-2 pt-2"><span class="font-body-sm text-body-sm text-on-surface-variant">Paid ${formatMoney(booking.amount_paid)} · Balance ${formatMoney(booking.balance_due)}</span><div class="flex gap-2"><a class="hp-wishlist-action" href="booking-confirmation.html?id=${encodeURIComponent(booking.id)}">View Ticket</a>${booking.status !== 'Cancelled' && booking.status !== 'Completed' ? `<button class="hp-wishlist-action" type="button" data-cancel-booking="${escapeHtml(booking.id)}">Cancel</button>` : ''}</div></div>`;
        list.append(card);
      });
    }

    function setActiveStatus(status) {
      selectedStatus = status;
      categoryButtons.forEach((button) => {
        const label = button.querySelector('span')?.textContent.trim();
        const active = (label === 'Upcoming' && status === 'Confirmed') || label === status;
        button.classList.toggle('bg-primary', active);
        button.classList.toggle('text-on-primary', active);
        button.classList.toggle('shadow-sm', active);
        button.classList.toggle('bg-surface-container-high', !active);
        button.classList.toggle('text-on-surface-variant', !active);
      });
      renderBookings();
    }

    async function loadBookings() {
      list.textContent = 'Loading your bookings…';
      try {
        bookings = await window.HappynessAPI.listMyBookings(user.id);
        updateCounts();
        setActiveStatus(selectedStatus);
      } catch (error) {
        console.error(error);
        list.replaceChildren();
        const message = document.createElement('p');
        message.className = 'font-body-sm text-body-sm text-on-surface-variant';
        message.textContent = error.message || 'We could not load your bookings.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'mt-3 rounded-xl bg-primary px-4 py-2 text-on-primary';
        retry.textContent = 'Retry';
        retry.addEventListener('click', loadBookings);
        list.append(message, retry);
      }
    }

    categoryButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const label = button.querySelector('span')?.textContent.trim();
        setActiveStatus(label === 'Upcoming' ? 'Confirmed' : label);
      });
    });
    list.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-cancel-booking]');
      if (!button || !window.confirm('Cancel this booking? Seats will be returned to the trip.')) return;
      button.disabled = true;
      try {
        await window.HappynessAPI.cancelBooking(button.dataset.cancelBooking);
        window.happynessToast?.('Your booking has been cancelled.');
        await loadBookings();
      } catch (error) {
        console.error(error);
        window.happynessToast?.(error.message || 'We could not cancel this booking.');
      } finally {
        button.disabled = false;
      }
    });
    await loadBookings();
  }

})();