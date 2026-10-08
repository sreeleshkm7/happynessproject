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
    resolveImage,
    canReviewTrip,
    createReview,
    getMyProfile
  });
})();
