(function () {
  const PAGE_SIZE = 12;

  function getClient() {
    if (!window.hpSupabase) throw new Error('Supabase is not configured. Add the project URL and anon key in js/config.js.');
    return window.hpSupabase;
  }

  function searchPattern(value) {
    return String(value || '').replace(/[,%()\\"]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function dateOnly(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function nextWeekendRange() {
    const start = new Date();
    const daysUntilSaturday = start.getDay() === 0 ? -1 : (6 - start.getDay());
    start.setDate(start.getDate() + daysUntilSaturday);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: dateOnly(start), end: dateOnly(end) };
  }

  function todayDate() {
    return dateOnly(new Date());
  }

  function applyDuration(query, duration) {
    const days = {
      short: [2, 3],
      medium: [4, 5, 6],
      long: Array.from({ length: 24 }, (_, index) => index + 7)
    }[duration];
    if (!days) return query;
    return query.or(days.map((day) => `duration_label.ilike.%${day}D%`).join(','));
  }

  async function listTrips(filters, sort, page) {
    const criteria = filters || {};
    const pageNumber = Math.max(1, Number(page) || 1);
    const offset = (pageNumber - 1) * PAGE_SIZE;
    const client = getClient();

    try {
      let query = client.from('trips').select('*', { count: 'exact' }).eq('status', 'approved');
      const text = searchPattern(criteria.text);
      if (text) {
        const pattern = `%${text}%`;
        query = query.or([
          `title.ilike.${pattern}`,
          `destination.ilike.${pattern}`,
          `location.ilike.${pattern}`,
          `short_description.ilike.${pattern}`,
          `description.ilike.${pattern}`,
          `tag.ilike.${pattern}`
        ].join(','));
      }
      if (criteria.keyword) {
        const pattern = `%${searchPattern(criteria.keyword)}%`;
        query = query.or([
          `title.ilike.${pattern}`,
          `destination.ilike.${pattern}`,
          `location.ilike.${pattern}`,
          `short_description.ilike.${pattern}`,
          `description.ilike.${pattern}`,
          `tag.ilike.${pattern}`
        ].join(','));
      }
      if (Number.isFinite(Number(criteria.maxPrice))) query = query.lte('price_per_person', Number(criteria.maxPrice));
      if (Number.isFinite(Number(criteria.maxGroup))) query = query.lte('max_group', Number(criteria.maxGroup));
      if (criteria.tag) query = query.ilike('tag', `%${searchPattern(criteria.tag)}%`);
      if (criteria.destination) {
        const destination = searchPattern(criteria.destination);
        query = query.or(`destination.ilike.%${destination}%,location.ilike.%${destination}%,tag.ilike.%${destination}%`);
      }
      if (criteria.weekend) {
        const weekend = nextWeekendRange();
        query = query.gte('start_date', weekend.start).lte('start_date', weekend.end);
      }
      if (criteria.upcoming && !criteria.weekend) {
        query = query.or(`start_date.gte.${todayDate()},start_date.is.null`);
      }
      if (criteria.duration) query = applyDuration(query, criteria.duration);
      if (criteria.difficulty) query = query.ilike('difficulty', searchPattern(criteria.difficulty));

      const sortValue = sort || criteria.sort || 'earliest';
      if (sortValue === 'price_asc') query = query.order('price_per_person', { ascending: true });
      else if (sortValue === 'price_desc') query = query.order('price_per_person', { ascending: false });
      else if (sortValue === 'rating_desc') query = query.order('rating', { ascending: false });
      else if (sortValue === 'seats_desc') query = query.order('seats_left', { ascending: false });
      else query = query.order('start_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

      const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      return { trips: data || [], total: count || 0, page: pageNumber, pageSize: PAGE_SIZE };
    } catch (error) {
      throw new Error('Could not load trips from Supabase.', { cause: error });
    }
  }

  async function searchTrips(text, filters, sort, page) {
    return listTrips({ ...(filters || {}), text }, sort, page);
  }

  async function listFeaturedDestinations() {
    const client = getClient();
    try {
      const { data, error } = await client.from('trips')
        .select('destination,cover_image_path,start_date,created_at')
        .eq('status', 'approved')
        .or(`start_date.gte.${todayDate()},start_date.is.null`)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const destinations = new Map();
      (data || []).forEach((trip) => {
        const name = String(trip.destination || '').trim();
        const key = name.toLocaleLowerCase();
        if (name && !destinations.has(key)) {
          destinations.set(key, { destination: name, cover_image_path: trip.cover_image_path });
        }
      });
      return [...destinations.values()].slice(0, 4);
    } catch (error) {
      throw new Error('Could not load popular destinations.', { cause: error });
    }
  }

  async function listRecentReviews(limit) {
    const client = getClient();
    try {
      const { data, error } = await client.from('reviews')
        .select('rating,comment,created_at,trip:trips!inner(title,destination,status)')
        .eq('trip.status', 'approved')
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(8, Number(limit) || 6)));
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error('Could not load recent trip reviews.', { cause: error });
    }
  }

  async function getTrip(slugOrId) {
    const key = String(slugOrId || '').trim();
    if (!key) throw new Error('A trip ID or slug is required.');
    const client = getClient();

    try {
      let tripQuery = client.from('trips').select('*');
      tripQuery = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)
        ? tripQuery.eq('id', key)
        : tripQuery.eq('slug', key);
      const { data: trip, error: tripError } = await tripQuery.maybeSingle();
      if (tripError) throw tripError;
      if (!trip) return null;

      const [images, itinerary, inclusions, pickupPoints, reviews, hostProfile] = await Promise.all([
        client.from('trip_images').select('id,path,sort_order').eq('trip_id', trip.id).order('sort_order'),
        client.from('trip_itinerary_days').select('id,day_number,title,description').eq('trip_id', trip.id).order('day_number'),
        client.from('trip_inclusions').select('id,kind,title,text,sort_order').eq('trip_id', trip.id).order('sort_order'),
        client.from('trip_pickup_points').select('id,name,address,reporting_time,sort_order').eq('trip_id', trip.id).order('sort_order'),
        client.from('reviews').select('id,user_id,rating,comment,created_at').eq('trip_id', trip.id).order('created_at', { ascending: false }),
        client.from('host_profiles').select('id,display_name,bio,company,verified,certifications,avatar_path').eq('id', trip.host_id).maybeSingle()
      ]);
      for (const result of [images, itinerary, inclusions, pickupPoints, reviews, hostProfile]) {
        if (result.error) throw result.error;
      }
      return {
        ...trip,
        images: images.data || [],
        itinerary: itinerary.data || [],
        inclusions: inclusions.data || [],
        pickup_points: pickupPoints.data || [],
        reviews: reviews.data || [],
        host: hostProfile.data || null
      };
    } catch (error) {
      throw new Error('Could not load this trip from Supabase.', { cause: error });
    }
  }

  function resolveImage(path) {
    if (!path) return '';
    const imagePath = String(path);
    if (/^https?:\/\//i.test(imagePath)) return imagePath;
    if (imagePath.startsWith('images/')) {
      return window.location.pathname.endsWith('/index.html') || window.location.pathname.endsWith('/')
        ? imagePath
        : `../${imagePath}`;
    }
    const client = getClient();
    try {
      const { data, error } = client.storage.from('trip-images').getPublicUrl(imagePath);
      if (error) throw error;
      return data.publicUrl;
    } catch (error) {
      throw new Error('Could not resolve the trip image URL.', { cause: error });
    }
  }

  async function canReviewTrip(tripId, userId) {
    const client = getClient();
    try {
      const { data: booking, error: bookingError } = await client.from('bookings')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .eq('status', 'Confirmed')
        .limit(1)
        .maybeSingle();
      if (bookingError) throw bookingError;
      if (!booking) return false;
      const { data: review, error: reviewError } = await client.from('reviews')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .maybeSingle();
      if (reviewError) throw reviewError;
      return !review;
    } catch (error) {
      throw new Error('Could not verify review eligibility.', { cause: error });
    }
  }

  async function createReview(tripId, userId, rating, comment) {
    const client = getClient();
    try {
      const { data, error } = await client.from('reviews')
        .insert({ trip_id: tripId, user_id: userId, rating, comment })
        .select('id,user_id,rating,comment,created_at')
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error('Could not submit your review.', { cause: error });
    }
  }

  async function getWishlist(userId) {
    const client = getClient();
    try {
      const { data, error } = await client.from('wishlist_items')
        .select('trip_id,created_at,trip:trips(id,slug,title,destination,location,short_description,cover_image_path,price_per_person,start_date,date_label,duration_label,seats_left,max_group,difficulty,rating,review_count)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error('Could not load your wishlist.', { cause: error });
    }
  }

  async function getWishlistIds(userId) {
    const client = getClient();
    try {
      const { data, error } = await client.from('wishlist_items')
        .select('trip_id')
        .eq('user_id', userId);
      if (error) throw error;
      return (data || []).map((item) => item.trip_id);
    } catch (error) {
      throw new Error('Could not load saved trips.', { cause: error });
    }
  }

  async function addWishlistItem(userId, tripId) {
    const client = getClient();
    try {
      const { error } = await client.from('wishlist_items')
        .upsert({ user_id: userId, trip_id: tripId }, { onConflict: 'user_id,trip_id', ignoreDuplicates: true });
      if (error) throw error;
    } catch (error) {
      throw new Error('Could not save this trip.', { cause: error });
    }
  }

  async function removeWishlistItem(userId, tripId) {
    const client = getClient();
    try {
      const { error } = await client.from('wishlist_items')
        .delete()
        .eq('user_id', userId)
        .eq('trip_id', tripId);
      if (error) throw error;
    } catch (error) {
      throw new Error('Could not remove this saved trip.', { cause: error });
    }
  }

  async function getCart(userId) {
    const client = getClient();
    try {
      const { data, error } = await client.from('cart_items')
        .select('trip_id,travellers,created_at,updated_at,trip:trips(id,slug,title,destination,location,short_description,cover_image_path,price_per_person,start_date,date_label,duration_label,seats_left,max_group,difficulty,pay_at_pickup_allowed)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error('Could not load your cart.', { cause: error });
    }
  }

  async function saveCartItem(userId, tripId, travellers) {
    const client = getClient();
    try {
      const { error } = await client.from('cart_items')
        .upsert({ user_id: userId, trip_id: tripId, travellers }, { onConflict: 'user_id,trip_id' });
      if (error) throw error;
    } catch (error) {
      throw new Error('Could not update your cart.', { cause: error });
    }
  }

  async function removeCartItem(userId, tripId) {
    const client = getClient();
    try {
      const { error } = await client.from('cart_items')
        .delete()
        .eq('user_id', userId)
        .eq('trip_id', tripId);
      if (error) throw error;
    } catch (error) {
      throw new Error('Could not remove this trip from your cart.', { cause: error });
    }
  }

  async function moveWishlistItemToCart(userId, tripId, travellers) {
    await saveCartItem(userId, tripId, travellers);
    await removeWishlistItem(userId, tripId);
  }

  async function getMyItemCounts(userId) {
    const client = getClient();
    try {
      const [cart, wishlist] = await Promise.all([
        client.from('cart_items').select('trip_id', { count: 'exact', head: true }).eq('user_id', userId),
        client.from('wishlist_items').select('trip_id', { count: 'exact', head: true }).eq('user_id', userId)
      ]);
      if (cart.error) throw cart.error;
      if (wishlist.error) throw wishlist.error;
      return { cart: cart.count || 0, wishlist: wishlist.count || 0 };
    } catch (error) {
      throw new Error('Could not load your cart and wishlist counts.', { cause: error });
    }
  }

  async function getCoupon(code) {
    const client = getClient();
    try {
      const { data, error } = await client.from('coupons')
        .select('code,percent_off')
        .eq('code', String(code || '').trim().toUpperCase())
        .eq('active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error('Could not verify this coupon.', { cause: error });
    }
  }

  async function createBooking(booking) {
    const client = getClient();
    try {
      const { data, error } = await client.rpc('create_booking', {
        p_trip_id: booking.tripId,
        p_adults: booking.adults,
        p_children: booking.children,
        p_infants: booking.infants,
        p_travellers: booking.travellers,
        p_contact: booking.contact,
        p_pickup: booking.pickupPoint,
        p_payment_method: booking.paymentMethod,
        p_coupon: booking.couponCode || null,
        p_partial: booking.partial
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(error.message || 'Could not create your booking.', { cause: error });
    }
  }

  async function getBooking(identifier) {
    const client = getClient();
    try {
      let query = client.from('bookings')
        .select('id,booking_ref,trip_id,adults,children,infants,trip_snapshot,subtotal,discount,gst,convenience_fee,total,amount_paid,balance_due,status,payment_method,pickup_point,contact_name,contact_mobile,contact_email,emergency_name,emergency_relation,emergency_mobile,special_requests,coupon_code,created_at,booking_travellers(id,type,full_name,age,dob,gender,id_type,id_number),payments(method,status,amount,last4,provider_ref,created_at)');
      query = /^HP-\d{4}-\d+$/i.test(identifier)
        ? query.eq('booking_ref', identifier)
        : query.eq('id', identifier);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error('Could not load this booking.', { cause: error });
    }
  }

  async function listMyBookings(userId) {
    const client = getClient();
    try {
      const { data, error } = await client.from('bookings')
        .select('id,booking_ref,trip_id,adults,children,infants,trip_snapshot,subtotal,discount,gst,convenience_fee,total,amount_paid,balance_due,status,payment_method,pickup_point,created_at,booking_travellers(id,type,full_name,age,dob,gender,id_type,id_number),payments(method,status,amount,last4,created_at)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error('Could not load your bookings.', { cause: error });
    }
  }

  async function cancelBooking(bookingId) {
    const client = getClient();
    try {
      const { data, error } = await client.rpc('cancel_booking', { p_booking_id: bookingId });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(error.message || 'Could not cancel this booking.', { cause: error });
    }
  }

  async function createHostTrip(trip) {
    const client = getClient();
    try {
      const { data, error } = await client.from('trips')
        .insert(trip)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(error.message || 'Could not create this trip.', { cause: error });
    }
  }

  async function updateHostTrip(tripId, trip) {
    const client = getClient();
    try {
      const { data, error } = await client.from('trips')
        .update(trip)
        .eq('id', tripId)
        .select('id,status')
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(error.message || 'Could not update this trip.', { cause: error });
    }
  }

  async function saveHostTripContent(tripId, content) {
    const client = getClient();
    const relations = [
      ['trip_itinerary_days', content.itinerary],
      ['trip_inclusions', content.inclusions],
      ['trip_pickup_points', content.pickupPoints],
      ['trip_images', content.images]
    ];
    try {
      for (const [table, rows] of relations) {
        const { error: deleteError } = await client.from(table).delete().eq('trip_id', tripId);
        if (deleteError) throw deleteError;
        if (rows.length) {
          const { error: insertError } = await client.from(table).insert(rows);
          if (insertError) throw insertError;
        }
      }
    } catch (error) {
      throw new Error(error.message || 'Could not save trip details.', { cause: error });
    }
  }

  async function uploadTripImage(userId, tripId, file) {
    const client = getClient();
    const allowedTypes = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    if (!file || !allowedTypes[file.type] || file.size > 5 * 1024 * 1024) {
      throw new Error('Choose a JPG, PNG, WebP, or GIF image no larger than 5 MB.');
    }
    try {
      const path = `${userId}/${tripId}/${crypto.randomUUID()}.${allowedTypes[file.type]}`;
      const { data, error } = await client.storage.from('trip-images').upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false
      });
      if (error) throw error;
      return data.path;
    } catch (error) {
      throw new Error(error.message || 'Could not upload this image.', { cause: error });
    }
  }

  async function listHostTrips(userId) {
    const client = getClient();
    try {
      const { data, error } = await client.from('trips')
        .select('id,slug,title,destination,date_label,price_per_person,status,seats_total,seats_left,created_at,bookings(id,booking_ref,adults,children,infants,status,contact_name,booking_travellers(full_name,type,age))')
        .eq('host_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error('Could not load your hosted trips.', { cause: error });
    }
  }

  async function listPendingTrips() {
    const client = getClient();
    try {
      const { data, error } = await client.from('trips')
        .select('id,title,destination,date_label,price_per_person,status,host_id,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error('Could not load trips awaiting approval.', { cause: error });
    }
  }

  async function reviewPendingTrip(tripId, status) {
    const client = getClient();
    if (!['approved', 'rejected'].includes(status)) throw new Error('Choose approve or reject.');
    try {
      const { data, error } = await client.from('trips')
        .update({ status })
        .eq('id', tripId)
        .eq('status', 'pending')
        .select('id,status')
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(error.message || 'Could not update this trip approval.', { cause: error });
    }
  }

  async function updateMyProfile(userId, profile) {
    const client = getClient();
    const changes = {
      username: String(profile?.username || '').trim(),
      full_name: String(profile?.full_name || '').trim(),
      mobile: String(profile?.mobile || '').trim()
    };
    if (!changes.username || !changes.full_name) throw new Error('Username and full name are required.');
    try {
      const { data, error } = await client.from('profiles')
        .update(changes)
        .eq('id', userId)
        .select('id,username,full_name,mobile,role')
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      if (error && error.code === '23505') throw new Error('That username is already taken.', { cause: error });
      throw new Error(error.message || 'Could not update your profile.', { cause: error });
    }
  }

  async function createCustomTripRequest(request) {
    const client = getClient();
    try {
      const { error } = await client.from('custom_trip_requests').insert(request);
      if (error) throw error;
      return request.id;
    } catch (error) {
      throw new Error(error.message || 'Could not send your trip request.', { cause: error });
    }
  }

  async function createContactMessage(message) {
    const client = getClient();
    try {
      const { error } = await client.from('contact_messages').insert(message);
      if (error) throw error;
    } catch (error) {
      throw new Error(error.message || 'Could not send your message.', { cause: error });
    }
  }

  async function subscribeNewsletter(email) {
    const client = getClient();
    try {
      const { error } = await client.from('newsletter_subscribers')
        .upsert({ email: String(email).trim().toLowerCase() }, { onConflict: 'email', ignoreDuplicates: true });
      if (error) throw error;
    } catch (error) {
      throw new Error(error.message || 'Could not add you to the newsletter.', { cause: error });
    }
  }

  async function getMyProfile(userId) {
    const client = getClient();
    try {
      const { data, error } = await client
        .from('profiles')
        .select('id, username, full_name, mobile, role')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error('Profile lookup failed.', { cause: error });
    }
  }

  window.HappynessAPI = Object.freeze({
    isConfigured: () => Boolean(window.hpSupabase),
    listTrips,
    getTrip,
    searchTrips,
    listFeaturedDestinations,
    listRecentReviews,
    resolveImage,
    canReviewTrip,
    createReview,
    getWishlist,
    getWishlistIds,
    addWishlistItem,
    removeWishlistItem,
    getCart,
    saveCartItem,
    removeCartItem,
    moveWishlistItemToCart,
    getMyItemCounts,
    getCoupon,
    createBooking,
    getBooking,
    listMyBookings,
    cancelBooking,
    createHostTrip,
    updateHostTrip,
    saveHostTripContent,
    uploadTripImage,
    listHostTrips,
    listPendingTrips,
    reviewPendingTrip,
    updateMyProfile,
    createCustomTripRequest,
    createContactMessage,
    subscribeNewsletter,
    getMyProfile
  });
})();
