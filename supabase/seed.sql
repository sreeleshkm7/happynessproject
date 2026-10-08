-- Run after the initial migration and after creating the trip host in Supabase Auth.
-- Replace this email with the exact Auth user email before running this seed.
do $$
declare
  host_email constant text := 'sreeleshkm7@gmail.com';
  host_id uuid;
begin
  select id into host_id
  from auth.users
  where lower(email) = lower(host_email);

  if host_id is null then
    raise exception
      'Create the host in Supabase Auth first, then replace sreeleshkm7@gmail.com in supabase/seed.sql';
  end if;

  update public.profiles
  set role = 'host',
      full_name = coalesce(nullif(full_name, ''), 'Aakash Mehta')
  where id = host_id;

  insert into public.host_profiles (
    id, display_name, bio, company, verified, certifications, avatar_path
  ) values (
    host_id,
    'Aakash Mehta',
    'Experienced mountain expedition leader with more than eight Spiti expeditions.',
    'HappynessProject',
    true,
    array['Wilderness First Responder'],
    'images/image-b692567.jpg'
  )
  on conflict (id) do nothing;
end;
$$;

-- Seed current catalog values. Date labels are preserved verbatim; the source
-- site does not provide departure years, so start_date/end_date remain unset.
insert into public.trips (
  id, host_id, slug, title, destination, location, short_description, description,
  tag, cover_image_path, price_per_person, start_date, end_date, date_label,
  duration_label, seats_total, seats_left, min_group, max_group, rating,
  review_count, difficulty, pay_at_pickup_allowed, cancellation_policy, status
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    (select id from auth.users where lower(email) = lower('sreeleshkm7@gmail.com')),
    'meghalaya-monsoon', 'Meghalaya Monsoon Trek & Waterfalls',
    'Meghalaya', 'Shillong & Cherrapunji',
    'A monsoon-season adventure among Meghalaya''s waterfalls and green hills.',
    '', 'Adventure', 'images/image-3398b60.jpg',
    18499, null, null, 'May 2–7', '6D / 5N', 20, 12, 1, 20, 0, 0,
    'Moderate', true, '', 'approved'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    (select id from auth.users where lower(email) = lower('sreeleshkm7@gmail.com')),
    'spiti-stargazing', 'Spiti Valley: High Altitude Stargazing & Monastery Circuit',
    'Spiti Valley', 'Kaza, Spiti, Himachal Pradesh',
    'An intimate Himalayan expedition through ancient monasteries, high villages, and star-filled skies.',
    'Leave the ordinary world behind as we traverse the awe-inspiring high passes of Himachal Pradesh into the middle land of Spiti. This intimate group journey balances rugged Himalayan exploration with quiet soulful pauses: sitting by ancient prayer wheels at thousand-year-old Key Gompa, sending hand-written postcards from the world''s highest post office at Hikkim, and camping beside the mythical moon lake of Chandratal under zero light pollution.',
    'Adventure', 'images/image-6fb112d.jpg',
    24999, null, null, 'May 18–24', '7D / 6N', 14, 4, 1, 14, 0, 0,
    'Moderate', true, 'Flexible cancellation policy', 'approved'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    (select id from auth.users where lower(email) = lower('sreeleshkm7@gmail.com')),
    'gokarna-acoustic', 'Gokarna Cliffside Sunset & Acoustic Jam',
    'Gokarna', 'Gokarna & Murudeshwar',
    'Coastal sunsets, cliffside time, and a relaxed acoustic gathering.',
    '', 'Beach & Chill', 'images/image-2865119.jpg',
    11200, null, null, 'May 10–12', '4D / 3N', 20, 8, 1, 20, 0, 0,
    'Easy', true, '', 'approved'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    (select id from auth.users where lower(email) = lower('sreeleshkm7@gmail.com')),
    'kerala-backwaters', 'Kerala Backwaters & Rainforest Trek',
    'Kerala', 'Wayanad & Alleppey',
    'A nature-led Kerala escape across rainforest trails and peaceful backwaters.',
    '', 'Heritage & Nature', 'images/image-f827caa.jpg',
    12499, null, null, 'April 24–27', '4D / 3N', 20, 6, 1, 20, 0, 0,
    'Moderate', true, '', 'approved'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    (select id from auth.users where lower(email) = lower('sreeleshkm7@gmail.com')),
    'meghalaya-roots', 'Meghalaya: Living Root Bridges & Caving',
    'Meghalaya', 'Cherrapunji & Shnongpdeng',
    'Explore living root bridges, caves, and the landscapes of Meghalaya.',
    '', 'Adventure', 'images/image-840f3eb.jpg',
    21999, null, null, 'May 2–7', '6D / 5N', 20, 3, 1, 20, 0, 0,
    'Moderate', true, '', 'approved'
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    (select id from auth.users where lower(email) = lower('sreeleshkm7@gmail.com')),
    'gokarna-beach-camp', 'Gokarna & Murudeshwar Beach Camp',
    'Gokarna', 'Gokarna Cliff Trail',
    'A short beach camping escape along the Gokarna coast.',
    '', 'Beach & Chill', 'images/image-7982c16.jpg',
    7999, null, null, 'May 10–12', '3D / 2N', 20, 8, 1, 20, 0, 0,
    'Easy', true, '', 'approved'
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    (select id from auth.users where lower(email) = lower('sreeleshkm7@gmail.com')),
    'jaisalmer-dunes', 'Jaisalmer Dune Camping & Stargazing',
    'Jaisalmer', 'Thar Desert & Fort',
    'Desert camping and stargazing among the dunes of Jaisalmer.',
    '', 'Oct Season Special', 'images/image-1cb936b.jpg',
    14800, null, null, 'Autumn Departure', '4D / 3N', 20, 5, 1, 20, 0, 0,
    'Easy', true, '', 'approved'
  )
on conflict (slug) do nothing;

insert into public.trip_images (trip_id, path, sort_order)
select seed.trip_id, seed.path, seed.sort_order
from (
  values
    ('20000000-0000-4000-8000-000000000002'::uuid, 'images/image-a912037.jpg', 1),
    ('20000000-0000-4000-8000-000000000002'::uuid, 'images/image-b9c4700.jpg', 2),
    ('20000000-0000-4000-8000-000000000002'::uuid, 'images/image-424fd6d.jpg', 3)
) as seed(trip_id, path, sort_order)
where not exists (
  select 1 from public.trip_images existing
  where existing.trip_id = seed.trip_id
    and existing.sort_order = seed.sort_order
);

insert into public.trip_itinerary_days (trip_id, day_number, title, description)
values
  (
    '20000000-0000-4000-8000-000000000002', 1,
    'Manali to Kaza via Atal Tunnel & Kunzum Pass',
    'Depart early morning from Manali. Drive through the historic Atal Tunnel, crossing from lush green Kullu into the stark dry gorges of Lahaul. Ascent over the mighty Kunzum Pass (14,931 ft) with a ritual stop at Kunzum Mata Temple before rolling into Kaza for evening sunset chai and group orientation. Drive: 200 km / 8 hrs. Stay: Traditional Spiti Homestay.'
  ),
  (
    '20000000-0000-4000-8000-000000000002', 2,
    'Key Monastery & Hikkim Post Office',
    'Ascend to Key Monastery for a private morning tea session with resident monks. Explore the ancient prayer chambers dating back to the 11th century. Later drive to Hikkim (14,567 ft) to post hand-stamped letters from the world''s highest operational post office to your loved ones. Includes postcard writing workshop and Spitian Thukpa lunch.'
  ),
  (
    '20000000-0000-4000-8000-000000000002', 3,
    'Komic, Langza & Astrophotography Workshop',
    'Visit Komic, the highest village in the world connected by a motorable road (15,027 ft). Head to Langza to marvel at the giant golden Buddha statue gazing at Chau Chau Kang Nilda peak. Evening guided astrophotography masterclass learning shutter drag, long exposures, and tracking the galactic core.'
  ),
  (
    '20000000-0000-4000-8000-000000000002', 4,
    'Pin Valley National Park & Mudh Homestay',
    'Head south into the lush, dramatic biome of Pin Valley. Spot Himalayan ibex grazing along shale screes and explore Mudh Village, the trailhead for the Pin Parvati pass. Cozy up inside an authentic wood-fired mud homestay eating fresh buckwheat rotis.'
  ),
  (
    '20000000-0000-4000-8000-000000000002', 5,
    'Chandratal Lake Camping & Milky Way Gazing',
    'Journey toward the crown jewel of Himachal: Chandratal (The Moon Lake). Check into premium insulated Swiss alpine tents. Walk 2km to the lake edge to watch the waters shift from deep turquoise to sapphire blue as twilight falls, followed by an open-air campfire astronomy session.'
  ),
  (
    '20000000-0000-4000-8000-000000000002', 6,
    'Trekking Lake Perimeter & Manali Return',
    'Witness a magnificent golden sunrise over the Chandra river basin. Scenic drive back over Rohtang/Atal pass into Old Manali. Celebrate our expedition completion with a celebratory dinner in a riverside cafe in Old Manali.'
  ),
  (
    '20000000-0000-4000-8000-000000000002', 7,
    'Farewell Breakfast & Airport / Volvo Transfer',
    'Relish a slow organic breakfast together, sharing photo drops and trip memoirs. Scheduled drop-off at Bhuntar Airport (Kullu) or luxury overnight Volvo bus transfers to Chandigarh/Delhi.'
  )
on conflict (trip_id, day_number) do update
set title = excluded.title, description = excluded.description;

insert into public.trip_inclusions (trip_id, kind, title, text, sort_order)
values
  ('20000000-0000-4000-8000-000000000002', 'included', 'All Accommodations (6 Nights)', 'Curated traditional mud homestays in Kaza & Mudh, plus luxury Swiss camping at Chandratal on twin/triple sharing.', 1),
  ('20000000-0000-4000-8000-000000000002', 'included', '4x4 Dedicated High-Clearance Transport', 'Modified Toyota Fortuner / Force Urbania with seasoned high-altitude mountain drivers throughout the journey.', 2),
  ('20000000-0000-4000-8000-000000000002', 'included', 'Full Board Meals', 'Daily mountain breakfasts and hot dinners prepared fresh with organic local Himalayan ingredients.', 3),
  ('20000000-0000-4000-8000-000000000002', 'included', 'High Altitude Safety Kit & O2 Cylinders', 'Medical-grade portable oxygen cylinders, fingertip pulse oximeters, and first-aid kits in every vehicle.', 4),
  ('20000000-0000-4000-8000-000000000002', 'included', 'Permits & Inner Line Clearances', 'All Himachal tourism environmental cesses, green taxes, and special wildlife reserve entrance fees.', 5),
  ('20000000-0000-4000-8000-000000000002', 'excluded', 'Domestic Flights or Train Tickets', 'Airfare to Chandigarh/Delhi or Bhuntar airport is not included.', 1),
  ('20000000-0000-4000-8000-000000000002', 'excluded', 'Lunch & Personal Snack Expenses', 'En-route roadside cafes, maggi points, and personal beverage orders during drive stops.', 2),
  ('20000000-0000-4000-8000-000000000002', 'excluded', 'Travel & Medical Insurance', 'We strongly recommend securing comprehensive adventure trek travel insurance before departure.', 3),
  ('20000000-0000-4000-8000-000000000002', 'excluded', 'Camera Fees & Monastery Donations', 'Personal offerings at religious shrines and special commercial DSLR shooting permits.', 4)
on conflict do nothing;

insert into public.trip_pickup_points (trip_id, name, address, reporting_time, sort_order)
values
  (
    '20000000-0000-4000-8000-000000000002',
    'Majnu Ka Tilla, New Delhi',
    'Assembly point: HP Petrol Pump / Monastery Gate. Overnight luxury Volvo departs at 06:30 PM for Manali.',
    '05:45 PM Day 0', 1
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'ISBT Sector 43, Chandigarh',
    'Direct boarding at main platform bays. Convenient for travelers arriving via Chandigarh Airport (IXC) or Shatabdi.',
    '11:30 PM Day 0', 2
  )
on conflict (trip_id, name) do update
set address = excluded.address,
    reporting_time = excluded.reporting_time,
    sort_order = excluded.sort_order;

insert into public.coupons (code, percent_off, active)
values ('HAPPY10', 10, true)
on conflict (code) do update
set percent_off = excluded.percent_off, active = excluded.active;

-- The old demo review cards had no Auth identities or verified booking records.
-- Import them only when matching accounts and confirmed bookings already exist.
insert into public.reviews (trip_id, user_id, rating, comment)
select
  '20000000-0000-4000-8000-000000000002',
  p.id,
  source.rating,
  source.comment
from (
  values
    (
      'priya nair',
      5,
      'The Milky Way at Chandratal made me cry happy tears. Aakash and the team managed our acclimatization effortlessly. The homestay hosts in Mudh treated us like family. Unforgettable group bonding!'
    ),
    (
      'siddharth v.',
      5,
      'As a solo traveler, joining this HappynessProject cohort was the best decision. Small group size meant no chaos. 4x4 vehicles handled the river crossings like a breeze.'
    )
) as source(username, rating, comment)
join public.profiles p on lower(p.username) = source.username
where exists (
  select 1 from public.bookings b
  where b.user_id = p.id
    and b.trip_id = '20000000-0000-4000-8000-000000000002'
    and b.status = 'Confirmed'
)
on conflict (trip_id, user_id) do nothing;
