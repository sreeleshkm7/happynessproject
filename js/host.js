(function () {
  const hostPage = window.location.pathname.endsWith('/host-a-trip.html');
  const dashboardPage = window.location.pathname.endsWith('/host-dashboard.html');
  const adminPage = window.location.pathname.endsWith('/admin-approvals.html');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

  function toast(message) {
    window.happynessToast?.(message);
  }

  function showAccessMessage(message) {
    const target = document.getElementById('host-access-message') || document.getElementById('host-dashboard-message') || document.getElementById('admin-approvals-message');
    if (!target) return;
    target.textContent = message;
    target.hidden = false;
  }

  function roleIs(role) {
    return window.HappynessAuth?.getProfile()?.role === role;
  }

  function setRowFields(row, values) {
    Object.entries(values || {}).forEach(([key, value]) => {
      const field = row.querySelector(`[data-field="${key}"]`);
      if (field) field.value = value ?? '';
    });
  }

  function makeRow(kind, index, values) {
    const row = document.createElement('div');
    row.className = 'rounded-xl border border-surface-variant bg-surface p-3';
    row.dataset.rowKind = kind;
    if (kind === 'included' || kind === 'excluded') {
      row.innerHTML = `<div class="flex gap-2"><input class="min-w-0 flex-1 rounded-lg border border-surface-variant bg-surface-container-lowest px-3 py-2 font-body-sm" data-field="title" placeholder="${kind === 'included' ? 'Inclusion' : 'Exclusion'}" maxlength="120"><button type="button" data-remove-row class="rounded-lg px-3 text-secondary" aria-label="Remove item">Remove</button></div>`;
    } else if (kind === 'pickup') {
      row.innerHTML = '<div class="grid gap-2 sm:grid-cols-3"><input class="rounded-lg border border-surface-variant bg-surface-container-lowest px-3 py-2 font-body-sm" data-field="name" placeholder="Pickup point name" maxlength="120"><input class="rounded-lg border border-surface-variant bg-surface-container-lowest px-3 py-2 font-body-sm" data-field="address" placeholder="Address (optional)" maxlength="240"><input class="rounded-lg border border-surface-variant bg-surface-container-lowest px-3 py-2 font-body-sm" data-field="reporting_time" placeholder="Reporting time (optional)" maxlength="80"></div><button type="button" data-remove-row class="mt-2 rounded-lg px-3 py-1 text-sm text-secondary">Remove pickup point</button>';
    } else {
      row.innerHTML = `<h4 class="mb-2 font-label-md text-label-md text-primary">Day ${index}</h4><div class="space-y-2"><input class="w-full rounded-lg border border-surface-variant bg-surface-container-lowest px-3 py-2 font-body-sm" data-field="title" placeholder="Day ${index} title" maxlength="140"><textarea class="w-full rounded-lg border border-surface-variant bg-surface-container-lowest px-3 py-2 font-body-sm" data-field="description" placeholder="Activities and schedule" rows="3" maxlength="3000"></textarea></div><button type="button" data-remove-row class="mt-2 rounded-lg px-3 py-1 text-sm text-secondary">Remove day</button>`;
    }
    setRowFields(row, values);
    return row;
  }

  function initRows() {
    const configs = [
      ['included', 'host-included-list'],
      ['excluded', 'host-excluded-list'],
      ['pickup', 'host-pickup-list'],
      ['itinerary', 'host-itinerary-list']
    ];
    configs.forEach(([kind, id]) => {
      document.querySelector(`[data-add-row="${kind}"]`).addEventListener('click', () => {
        const container = document.getElementById(id);
        container.append(makeRow(kind, container.children.length + 1));
      });
    });
    document.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-row]');
      if (remove) remove.closest('[data-row-kind]').remove();
    });
  }

  function previewFile(file, container, image) {
    if (!file) return;
    const preview = document.createElement('div');
    preview.className = 'flex items-center gap-3';
    if (image) {
      const img = document.createElement('img');
      img.className = 'h-16 w-20 rounded-lg object-cover';
      img.src = URL.createObjectURL(file);
      img.alt = 'Selected trip photo preview';
      preview.append(img);
    }
    const name = document.createElement('span');
    name.className = 'font-body-sm text-body-sm text-on-surface-variant';
    name.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    preview.append(name);
    container.append(preview);
  }

  function readFiles() {
    const cover = document.getElementById('host-cover-image').files[0] || null;
    const extras = [...document.getElementById('host-extra-images').files];
    const existingCount = currentTrip?.images?.length || 0;
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (cover && (!allowed.has(cover.type) || cover.size > 5 * 1024 * 1024)) {
      throw new Error('The cover image must be JPG, PNG, WebP, or GIF and no larger than 5 MB.');
    }
    if (extras.length + existingCount > 3) {
      throw new Error(`This trip can have at most three extra images. ${existingCount} are already saved.`);
    }
    if (extras.some((file) => !allowed.has(file.type) || file.size > 5 * 1024 * 1024)) {
      throw new Error('Each extra image must be JPG, PNG, WebP, or GIF and no larger than 5 MB.');
    }
    return { cover, extras };
  }

  function readRows(kind, tripId) {
    return [...document.querySelectorAll(`[data-row-kind="${kind}"]`)].map((row, index) => {
      const field = (name) => row.querySelector(`[data-field="${name}"]`).value.trim();
      if (kind === 'included' || kind === 'excluded') {
        const title = field('title');
        return title ? { trip_id: tripId, kind, title, text: title, sort_order: index + 1 } : null;
      }
      if (kind === 'pickup') {
        const name = field('name');
        return name ? {
          trip_id: tripId, name, address: field('address'), reporting_time: field('reporting_time'), sort_order: index + 1
        } : null;
      }
      const title = field('title');
      return title ? { trip_id: tripId, day_number: index + 1, title, description: field('description') } : null;
    }).filter(Boolean);
  }

  function formTrip(status) {
    const destination = document.getElementById('host-destination').value.trim();
    const title = document.getElementById('host-title').value.trim();
    const description = document.getElementById('host-description').value.trim();
    const seatsTotal = Math.max(1, Number(document.getElementById('host-seats').value) || 1);
    const minGroup = Math.max(1, Number(document.getElementById('host-min-group').value) || 1);
    const maxGroup = Math.max(seatsTotal, Number(document.getElementById('host-max-group').value) || seatsTotal);
    const startDate = document.getElementById('host-start-date').value || null;
    const endDate = document.getElementById('host-end-date').value || null;
    return {
      slug: currentTrip?.slug || `${title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)}-${crypto.randomUUID().slice(0, 8)}`,
      title,
      destination,
      location: destination,
      short_description: document.getElementById('host-short-description').value.trim() || description.slice(0, 220),
      description,
      tag: document.getElementById('host-tag').value.trim(),
      price_per_person: Math.max(0, Number(document.getElementById('host-price').value) || 0),
      start_date: startDate,
      end_date: endDate,
      date_label: startDate && endDate ? `${startDate} – ${endDate}` : '',
      duration_label: document.getElementById('host-duration').value.trim(),
      seats_total: seatsTotal,
      min_group: Math.min(minGroup, seatsTotal),
      max_group: maxGroup,
      difficulty: document.getElementById('host-difficulty').value,
      pay_at_pickup_allowed: document.getElementById('host-pay-pickup').checked,
      cancellation_policy: document.getElementById('host-cancellation')?.value || '',
      status
    };
  }

  let currentTrip = null;
  let currentTripId = null;
  let hostStep = 0;

  function updateReview() {
    const value = (id) => document.getElementById(id).value;
    document.getElementById('host-review-destination').textContent = value('host-destination') || 'Destination';
    document.getElementById('host-review-title').textContent = value('host-title') || 'Trip title';
    document.getElementById('host-review-price').textContent = money(value('host-price'));
    document.getElementById('host-review-dates').textContent = `${value('host-start-date') || 'Start date'} – ${value('host-end-date') || 'End date'}`;
    document.getElementById('host-review-seats').textContent = `${value('host-seats') || 0} available`;
  }

  function showHostStep(index) {
    hostStep = Math.max(0, Math.min(4, index));
    document.querySelectorAll('[data-host-step]').forEach((section, stepIndex) => {
      section.hidden = stepIndex !== hostStep;
    });
    document.querySelectorAll('[data-host-step-indicator]').forEach((indicator, stepIndex) => {
      indicator.classList.toggle('font-bold', stepIndex === hostStep);
      indicator.classList.toggle('text-primary', stepIndex === hostStep);
      indicator.classList.toggle('text-outline', stepIndex !== hostStep);
    });
    document.getElementById('host-previous').hidden = hostStep === 0;
    const next = document.getElementById('host-next');
    next.hidden = hostStep === 4;
    next.textContent = hostStep === 3 ? 'Next Step: Review' : `Next Step: ${['Basics', 'Photos', 'Pricing', 'Details', 'Review'][hostStep + 1]}`;
    if (hostStep === 4) updateReview();
  }

  function validateStep(stepIndex) {
    const section = document.querySelector(`[data-host-step="${stepIndex}"]`);
    for (const field of section.querySelectorAll('input[required],textarea[required],select[required]')) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    if (stepIndex === 2) {
      const start = document.getElementById('host-start-date').value;
      const end = document.getElementById('host-end-date').value;
      if (start && end && end < start) {
        toast('The trip end date must be on or after the start date.');
        return false;
      }
      const min = Number(document.getElementById('host-min-group').value);
      const max = Number(document.getElementById('host-max-group').value);
      const seats = Number(document.getElementById('host-seats').value);
      if (min > max || seats < min || seats > max) {
        toast('Available seats must be between the minimum and maximum group sizes.');
        return false;
      }
    }
    if (stepIndex === 1) {
      try {
        readFiles();
      } catch (error) {
        toast(error.message);
        return false;
      }
    }
    return true;
  }

  function fillTrip(trip) {
    const set = (id, value) => { document.getElementById(id).value = value ?? ''; };
    set('host-destination', trip.destination);
    set('host-title', trip.title);
    set('host-short-description', trip.short_description);
    set('host-description', trip.description);
    set('host-tag', trip.tag);
    set('host-price', trip.price_per_person);
    set('host-start-date', trip.start_date);
    set('host-end-date', trip.end_date);
    set('host-duration', trip.duration_label);
    set('host-min-group', trip.min_group);
    set('host-max-group', trip.max_group);
    set('host-seats', trip.seats_total);
    set('host-difficulty', trip.difficulty);
    document.getElementById('host-pay-pickup').checked = trip.pay_at_pickup_allowed === true;
    set('host-cancellation', trip.cancellation_policy);
    const coverPreview = document.getElementById('host-cover-preview');
    coverPreview.replaceChildren();
    if (trip.cover_image_path) {
      const image = document.createElement('img');
      image.className = 'h-20 w-28 rounded-lg object-cover';
      image.src = window.HappynessAPI.resolveImage(trip.cover_image_path);
      image.alt = 'Current cover photo';
      coverPreview.append(image);
    }
    const extraPreview = document.getElementById('host-extra-preview');
    (trip.images || []).forEach((imageRow) => {
      const image = document.createElement('img');
      image.className = 'h-20 w-full rounded-lg object-cover';
      image.src = window.HappynessAPI.resolveImage(imageRow.path);
      image.alt = 'Current trip photo';
      extraPreview.append(image);
    });
    const contents = [
      ['included', 'host-included-list', (trip.inclusions || []).filter((item) => item.kind === 'included').map((item) => ({ title: item.title }))],
      ['excluded', 'host-excluded-list', (trip.inclusions || []).filter((item) => item.kind === 'excluded').map((item) => ({ title: item.title }))],
      ['pickup', 'host-pickup-list', trip.pickup_points || []],
      ['itinerary', 'host-itinerary-list', trip.itinerary || []]
    ];
    contents.forEach(([kind, id, rows]) => {
      const container = document.getElementById(id);
      container.replaceChildren();
      rows.forEach((row, index) => container.append(makeRow(kind, index + 1, row)));
    });
    updateReview();
  }

  async function persistTrip(targetStatus) {
    const user = window.HappynessAuth?.getUser();
    const form = document.getElementById('host-trip-form');
    if (!user || !form) return;
    if (!validateStep(0)) {
      showHostStep(0);
      return;
    }
    if (targetStatus === 'pending') {
      for (const index of [1, 2, 3]) {
        if (!validateStep(index)) {
          showHostStep(index);
          return;
        }
      }
      if (!validateStep(4)) return;
      if (!document.getElementById('host-cover-image').files.length && !currentTrip?.cover_image_path) {
        showHostStep(1);
        toast('Upload a cover photo before submitting this trip.');
        return;
      }
      if (!readRows('pickup', 'pending').length) {
        showHostStep(3);
        toast('Add at least one pickup point before submitting.');
        return;
      }
    }

    const buttons = [...form.querySelectorAll('button')];
    buttons.forEach((button) => { button.disabled = true; });
    const progress = document.getElementById('host-upload-progress');
    try {
      const images = readFiles();
      const tripData = formTrip('draft');
      if (currentTripId) {
        await window.HappynessAPI.updateHostTrip(currentTripId, tripData);
      } else {
        const created = await window.HappynessAPI.createHostTrip({
          ...tripData,
          host_id: user.id,
          cover_image_path: '',
          status: 'draft'
        });
        currentTripId = created.id;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('id', currentTripId);
        window.history.replaceState({}, '', nextUrl);
      }
      let coverPath = currentTrip?.cover_image_path || '';
      const extraPaths = (currentTrip?.images || []).map((image) => image.path);
      const files = [...(images.cover ? [images.cover] : []), ...images.extras];
      for (const [index, file] of files.entries()) {
        progress.textContent = `Uploading image ${index + 1} of ${files.length}…`;
        const path = await window.HappynessAPI.uploadTripImage(user.id, currentTripId, file);
        if (index === 0 && images.cover) coverPath = path;
        else extraPaths.push(path);
      }
      const extraImages = extraPaths.map((path, index) => ({ trip_id: currentTripId, path, sort_order: index + 1 }));
      await window.HappynessAPI.saveHostTripContent(currentTripId, {
        itinerary: readRows('itinerary', currentTripId),
        inclusions: [...readRows('included', currentTripId), ...readRows('excluded', currentTripId)],
        pickupPoints: readRows('pickup', currentTripId),
        images: extraImages
      });
      await window.HappynessAPI.updateHostTrip(currentTripId, {
        ...tripData,
        cover_image_path: coverPath,
        status: targetStatus
      });
      progress.textContent = '';
      document.getElementById('host-trip-form').hidden = true;
      document.getElementById('host-previous').hidden = true;
      document.getElementById('host-next').hidden = true;
      document.getElementById('host-success-title').textContent = targetStatus === 'pending' ? 'Submission Received!' : 'Draft Saved';
      document.getElementById('host-success-message').textContent = targetStatus === 'pending'
        ? `Trip #${currentTripId} is Pending Approval and will be reviewed by our curation team.`
        : `Trip #${currentTripId} has been saved as a draft.`;
      document.getElementById('host-success').hidden = false;
    } catch (error) {
      console.error(error);
      progress.textContent = '';
      toast(error.message || 'We could not save this trip. Please try again.');
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  async function initHostForm() {
    initRows();
    document.getElementById('host-included-list').append(makeRow('included', 1));
    document.getElementById('host-excluded-list').append(makeRow('excluded', 1));
    document.getElementById('host-pickup-list').append(makeRow('pickup', 1));
    document.getElementById('host-itinerary-list').append(makeRow('itinerary', 1));
    if (!roleIs('host')) {
      showAccessMessage('A host account is required to create trips. Ask an administrator to grant the host role to your profile.');
      document.getElementById('host-trip-form').hidden = true;
      document.getElementById('host-previous').hidden = true;
      document.getElementById('host-next').hidden = true;
      return;
    }
    const editId = new URLSearchParams(window.location.search).get('id');
    if (editId) {
      try {
        currentTrip = await window.HappynessAPI.getTrip(editId);
        if (!currentTrip || !['draft', 'pending'].includes(currentTrip.status)) throw new Error('Only draft or pending trips can be edited.');
        currentTripId = currentTrip.id;
        fillTrip(currentTrip);
      } catch (error) {
        console.error(error);
        showAccessMessage(error.message || 'Could not load this trip for editing.');
        document.getElementById('host-trip-form').hidden = true;
        return;
      }
    }
    document.getElementById('host-next').addEventListener('click', () => {
      if (validateStep(hostStep)) showHostStep(hostStep + 1);
    });
    document.getElementById('host-previous').addEventListener('click', () => showHostStep(hostStep - 1));
    document.getElementById('host-save-draft').addEventListener('click', () => persistTrip('draft'));
    document.getElementById('host-submit-trip').addEventListener('click', () => persistTrip('pending'));
    document.getElementById('host-trip-form').addEventListener('input', updateReview);
    document.getElementById('host-cover-image').addEventListener('change', (event) => {
      try {
        readFiles();
        document.getElementById('host-cover-preview').replaceChildren();
        previewFile(event.target.files[0], document.getElementById('host-cover-preview'), true);
      } catch (error) {
        event.target.value = '';
        toast(error.message);
      }
    });
    document.getElementById('host-extra-images').addEventListener('change', (event) => {
      try {
        const files = readFiles().extras;
        const preview = document.getElementById('host-extra-preview');
        preview.replaceChildren();
        files.forEach((file) => previewFile(file, preview, true));
      } catch (error) {
        event.target.value = '';
        toast(error.message);
      }
    });
    showHostStep(0);
    updateReview();
  }

  async function initHostDashboard() {
    const list = document.getElementById('host-dashboard-list');
    if (!roleIs('host')) {
      showAccessMessage('A host account is required to view this dashboard.');
      list.hidden = true;
      document.querySelector('main > div a[href="host-a-trip.html"]').hidden = true;
      return;
    }
    async function load() {
      list.textContent = 'Loading your trips…';
      try {
        const trips = await window.HappynessAPI.listHostTrips(window.HappynessAuth.getUser().id);
        list.replaceChildren();
        if (!trips.length) {
          const empty = document.createElement('p');
          empty.className = 'rounded-xl bg-surface-container-lowest p-5 font-body-sm text-body-sm text-on-surface-variant';
          empty.textContent = 'No hosted trips yet. Create your first trip to get started.';
          list.append(empty);
          return;
        }
        trips.forEach((trip) => {
          const card = document.createElement('article');
          card.className = 'rounded-2xl border border-surface-container bg-surface-container-lowest p-5 shadow-sm';
          const bookings = trip.bookings || [];
          const travelers = bookings.flatMap((booking) => booking.booking_travellers || []);
          const travelerList = travelers.length
            ? travelers.map((traveler) => `<li class="py-1">${escapeHtml(traveler.full_name)} · ${escapeHtml(traveler.type)}${traveler.age ? ` · age ${Number(traveler.age)}` : ''}</li>`).join('')
            : '<li class="py-1 text-outline">No traveller details yet.</li>';
          card.innerHTML = `<div class="flex flex-wrap items-start justify-between gap-3"><div><span class="rounded-full bg-primary-fixed/40 px-2.5 py-1 text-xs font-semibold text-primary">${escapeHtml(trip.status)}</span><h2 class="mt-2 font-title-md text-title-md font-semibold text-on-surface">${escapeHtml(trip.title)}</h2><p class="font-body-sm text-body-sm text-on-surface-variant">${escapeHtml(trip.destination)} · ${escapeHtml(trip.date_label)}</p></div><strong class="font-price-display text-price-display text-primary">${money(trip.price_per_person)}</strong></div>` +
            `<p class="mt-3 font-body-sm text-body-sm text-on-surface-variant">${Number(trip.seats_left)} of ${Number(trip.seats_total)} seats available · ${bookings.length} booking${bookings.length === 1 ? '' : 's'}</p>` +
            `<details class="mt-4 rounded-xl bg-surface-container-low p-3"><summary class="cursor-pointer font-label-md text-label-md text-on-surface">Bookings &amp; traveller list</summary><ul class="mt-2 divide-y divide-surface-variant font-body-sm text-body-sm text-on-surface-variant">${travelerList}</ul></details>` +
            (['draft', 'pending'].includes(trip.status) ? `<a class="mt-4 inline-flex rounded-lg border border-primary px-4 py-2 font-label-md text-label-md text-primary" href="host-a-trip.html?id=${encodeURIComponent(trip.id)}">Edit trip</a>` : '');
          list.append(card);
        });
      } catch (error) {
        console.error(error);
        list.replaceChildren();
        const message = document.createElement('p');
        message.className = 'font-body-sm text-body-sm text-on-surface-variant';
        message.textContent = error.message || 'We could not load your hosted trips.';
        const retry = document.createElement('button');
        retry.className = 'mt-3 rounded-xl bg-primary px-4 py-2 text-on-primary';
        retry.type = 'button';
        retry.textContent = 'Retry';
        retry.addEventListener('click', load);
        list.append(message, retry);
      }
    }
    await load();
  }

  async function initAdminApprovals() {
    const list = document.getElementById('admin-approvals-list');
    if (!roleIs('admin')) {
      showAccessMessage('Administrator access is required to approve or reject trips.');
      list.hidden = true;
      return;
    }
    async function load() {
      list.textContent = 'Loading pending trips…';
      try {
        const trips = await window.HappynessAPI.listPendingTrips();
        list.replaceChildren();
        if (!trips.length) {
          const empty = document.createElement('p');
          empty.className = 'rounded-xl bg-surface-container-lowest p-5 font-body-sm text-body-sm text-on-surface-variant';
          empty.textContent = 'There are no trips awaiting approval.';
          list.append(empty);
          return;
        }
        trips.forEach((trip) => {
          const card = document.createElement('article');
          card.className = 'rounded-2xl border border-surface-container bg-surface-container-lowest p-5 shadow-sm';
          card.innerHTML = `<span class="rounded-full bg-tertiary-fixed px-2.5 py-1 text-xs font-semibold text-on-tertiary-fixed">Pending</span><h2 class="mt-3 font-title-md text-title-md font-semibold text-on-surface">${escapeHtml(trip.title)}</h2><p class="mt-1 font-body-sm text-body-sm text-on-surface-variant">${escapeHtml(trip.destination)} · ${escapeHtml(trip.date_label)} · ${money(trip.price_per_person)}</p><div class="mt-4 flex gap-3"><button type="button" data-approval=\"approved\" data-trip-id=\"${escapeHtml(trip.id)}\" class="rounded-xl bg-primary px-4 py-2 font-label-md text-label-md text-white">Approve</button><button type="button" data-approval=\"rejected\" data-trip-id=\"${escapeHtml(trip.id)}\" class="rounded-xl border border-secondary px-4 py-2 font-label-md text-label-md text-secondary">Reject</button></div>`;
          list.append(card);
        });
      } catch (error) {
        console.error(error);
        list.replaceChildren();
        const message = document.createElement('p');
        message.className = 'font-body-sm text-body-sm text-on-surface-variant';
        message.textContent = error.message || 'We could not load pending trips.';
        const retry = document.createElement('button');
        retry.className = 'mt-3 rounded-xl bg-primary px-4 py-2 text-on-primary';
        retry.type = 'button';
        retry.textContent = 'Retry';
        retry.addEventListener('click', load);
        list.append(message, retry);
      }
    }
    list.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-approval]');
      if (!button) return;
      button.disabled = true;
      try {
        await window.HappynessAPI.reviewPendingTrip(button.dataset.tripId, button.dataset.approval);
        toast(button.dataset.approval === 'approved' ? 'Trip approved.' : 'Trip rejected.');
        await load();
      } catch (error) {
        console.error(error);
        toast(error.message || 'Could not update this trip.');
        button.disabled = false;
      }
    });
    await load();
  }

  window.HappynessAuth?.ready.then(() => {
    if (hostPage) return initHostForm();
    if (dashboardPage) return initHostDashboard();
    if (adminPage) return initAdminApprovals();
    return undefined;
  });
})();
