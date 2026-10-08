-- HappynessProject initial schema, access policies, booking RPCs, and Storage.
-- Safe to re-run: objects are created conditionally and policies/triggers are replaced.

create sequence if not exists public.booking_ref_seq;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  full_name text not null default '',
  mobile text not null default '',
  role text not null default 'traveller'
    check (role in ('traveller', 'host', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_ci_uidx
  on public.profiles (lower(username));

create table if not exists public.host_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  company text not null default '',
  verified boolean not null default false,
  certifications text[] not null default '{}',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete restrict,
  slug text not null unique,
  title text not null,
  destination text not null,
  location text not null,
  short_description text not null default '',
  description text not null default '',
  tag text not null default '',
  cover_image_path text not null default '',
  price_per_person numeric(10,2) not null check (price_per_person >= 0),
  start_date date,
  end_date date,
  date_label text not null default '',
  duration_label text not null default '',
  seats_total integer not null default 1 check (seats_total >= 1),
  seats_left integer not null default 0 check (seats_left >= 0),
  min_group integer not null default 1 check (min_group >= 1),
  max_group integer not null default 1 check (max_group >= min_group),
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  difficulty text not null default 'Moderate',
  pay_at_pickup_allowed boolean not null default false,
  cancellation_policy text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_date_range_check
    check (start_date is null or end_date is null or end_date >= start_date),
  constraint trips_group_capacity_check
    check (min_group <= seats_total and seats_total <= max_group),
  constraint trips_seats_left_within_total_check check (seats_left <= seats_total)
);

create index if not exists trips_host_id_idx on public.trips (host_id);
create index if not exists trips_status_start_date_idx on public.trips (status, start_date);
create index if not exists trips_destination_idx on public.trips (destination);
create index if not exists trips_tag_idx on public.trips (tag);

create table if not exists public.trip_images (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  path text not null,
  sort_order smallint not null check (sort_order between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, sort_order),
  unique (trip_id, path)
);

create index if not exists trip_images_trip_id_idx on public.trip_images (trip_id);

create table if not exists public.trip_itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, day_number)
);

create index if not exists trip_itinerary_days_trip_id_idx
  on public.trip_itinerary_days (trip_id, day_number);

create table if not exists public.trip_inclusions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  kind text not null check (kind in ('included', 'excluded')),
  title text not null,
  text text not null default '',
  sort_order integer not null default 1 check (sort_order >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, kind, sort_order)
);

create index if not exists trip_inclusions_trip_id_idx
  on public.trip_inclusions (trip_id, kind, sort_order);

create table if not exists public.trip_pickup_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  address text not null default '',
  reporting_time text not null default '',
  sort_order integer not null default 1 check (sort_order >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, name)
);

create index if not exists trip_pickup_points_trip_id_idx
  on public.trip_pickup_points (trip_id, sort_order);

create table if not exists public.wishlist_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);

create index if not exists wishlist_items_trip_id_idx on public.wishlist_items (trip_id);

create table if not exists public.cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  travellers integer not null default 1 check (travellers >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);

create index if not exists cart_items_trip_id_idx on public.cart_items (trip_id);

create table if not exists public.coupons (
  code text primary key,
  percent_off numeric(5,2) not null check (percent_off > 0 and percent_off <= 100),
  active boolean not null default true,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete restrict,
  adults integer not null check (adults >= 1),
  children integer not null default 0 check (children >= 0),
  infants integer not null default 0 check (infants >= 0),
  price_per_adult numeric(10,2) not null check (price_per_adult >= 0),
  child_price_percent numeric(5,2) not null check (child_price_percent between 0 and 100),
  trip_snapshot jsonb not null default '{}'::jsonb,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  discount numeric(10,2) not null default 0 check (discount >= 0),
  gst numeric(10,2) not null default 0 check (gst >= 0),
  convenience_fee numeric(10,2) not null default 0 check (convenience_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  amount_paid numeric(10,2) not null default 0 check (amount_paid >= 0),
  balance_due numeric(10,2) not null default 0 check (balance_due >= 0),
  status text not null
    check (status in ('Confirmed', 'Pending Payment', 'Cancelled', 'Completed')),
  payment_method text not null,
  pickup_point text not null,
  contact_name text not null,
  contact_mobile text not null,
  contact_email text not null,
  emergency_name text not null default '',
  emergency_relation text not null default '',
  emergency_mobile text not null default '',
  special_requests text not null default '',
  coupon_code text references public.coupons(code) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_payment_balance_check
    check (amount_paid + balance_due = total)
);

create index if not exists bookings_user_id_created_at_idx
  on public.bookings (user_id, created_at desc);
create index if not exists bookings_trip_id_idx on public.bookings (trip_id);
create index if not exists bookings_coupon_code_idx on public.bookings (coupon_code);
create index if not exists bookings_status_idx on public.bookings (status);

create table if not exists public.booking_travellers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  type text not null check (type in ('adult', 'child', 'infant')),
  full_name text not null,
  age integer check (age is null or age >= 0),
  dob date,
  gender text not null default '',
  id_type text not null default '',
  id_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_travellers_booking_id_idx
  on public.booking_travellers (booking_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null default 'demo',
  method text not null,
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  amount numeric(10,2) not null check (amount >= 0),
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_booking_id_idx on public.payments (booking_id);

create table if not exists public.reviews (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists reviews_user_id_idx on public.reviews (user_id);

create table if not exists public.custom_trip_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  destination_ideas text not null default '',
  dates text not null default '',
  flexible boolean not null default false,
  travellers integer not null default 1 check (travellers >= 1),
  budget_min numeric(10,2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(10,2) check (budget_max is null or budget_max >= 0),
  interests text[] not null default '{}',
  stay_preference text not null default '',
  notes text not null default '',
  contact_name text not null default '',
  contact_email text not null,
  contact_mobile text not null default '',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_trip_budget_range_check
    check (budget_min is null or budget_max is null or budget_max >= budget_min)
);

create index if not exists custom_trip_requests_user_id_idx
  on public.custom_trip_requests (user_id);
create index if not exists custom_trip_requests_status_idx
  on public.custom_trip_requests (status);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) > 0),
  check (length(trim(email)) > 0),
  check (length(trim(subject)) > 0),
  check (length(trim(message)) > 0)
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(email)) > 0)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_host_profile_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
    else
      new.verified := old.verified;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.initialize_trip_seats()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.seats_left = 0 then
    new.seats_left := new.seats_total;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_trip_image_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  image_count integer;
begin
  perform 1 from public.trips where id = new.trip_id for update;
  select count(*) into image_count
  from public.trip_images
  where trip_id = new.trip_id
    and (tg_op = 'INSERT' or id <> new.id);
  if image_count >= 3 then
    raise exception 'A trip can have no more than three gallery images';
  end if;
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_host()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'host'
  );
$$;

create or replace function public.is_host_of_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    join public.profiles p on p.id = t.host_id
    where t.id = p_trip_id
      and t.host_id = auth.uid()
      and p.role = 'host'
  );
$$;

create or replace function public.can_access_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and (t.status = 'approved' or t.host_id = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  candidate_username text;
begin
  requested_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  candidate_username := coalesce(
    requested_username,
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'traveller'
  );

  if exists (
    select 1 from public.profiles
    where lower(username) = lower(candidate_username)
      and id <> new.id
  ) then
    candidate_username := candidate_username || '-' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles (id, username, full_name, mobile)
  values (
    new.id,
    candidate_username,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'mobile', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.refresh_trip_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_trip_id uuid;
begin
  affected_trip_id := coalesce(new.trip_id, old.trip_id);
  update public.trips t
  set rating = coalesce((
        select round(avg(r.rating)::numeric, 2)
        from public.reviews r where r.trip_id = affected_trip_id
      ), 0),
      review_count = (
        select count(*)::integer
        from public.reviews r where r.trip_id = affected_trip_id
      )
  where t.id = affected_trip_id;

  if tg_op = 'UPDATE' and old.trip_id is distinct from new.trip_id then
    update public.trips t
    set rating = coalesce((
          select round(avg(r.rating)::numeric, 2)
          from public.reviews r where r.trip_id = old.trip_id
        ), 0),
        review_count = (
          select count(*)::integer
          from public.reviews r where r.trip_id = old.trip_id
        )
    where t.id = old.trip_id;
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.create_booking(
  p_trip_id uuid,
  p_adults integer,
  p_children integer,
  p_infants integer,
  p_travellers jsonb,
  p_contact jsonb,
  p_pickup text,
  p_payment_method text,
  p_coupon text default null,
  p_partial boolean default false
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_booking public.bookings%rowtype;
  v_coupon public.coupons%rowtype;
  v_coupon_code text := nullif(upper(trim(p_coupon)), '');
  v_subtotal numeric(10,2);
  v_discount numeric(10,2) := 0;
  v_gst numeric(10,2);
  v_convenience_fee numeric(10,2) := 0;
  v_total numeric(10,2);
  v_amount_paid numeric(10,2);
  v_balance_due numeric(10,2);
  v_seats_required integer;
  v_traveller_count integer;
  v_booking_ref text;
  v_payment_status text;
  v_child_price_percent constant numeric(5,2) := 75.00;
  v_gst_percent constant numeric(5,4) := 0.0500;
  v_partial_payment_percent constant numeric(5,4) := 0.2500;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_adults is null or p_children is null or p_infants is null
     or p_adults < 1 or p_children < 0 or p_infants < 0 then
    raise exception 'At least one adult is required and traveller counts must be non-negative';
  end if;
  if p_travellers is null or p_contact is null
     or jsonb_typeof(p_travellers) <> 'array'
     or jsonb_typeof(p_contact) <> 'object' then
    raise exception 'Invalid traveller or contact details';
  end if;
  if p_payment_method is null
     or p_payment_method not in ('upi', 'card', 'net_banking', 'wallet', 'pay_later') then
    raise exception 'Unsupported payment method';
  end if;
  if length(trim(coalesce(p_pickup, ''))) = 0
     or length(trim(coalesce(p_contact ->> 'name', ''))) = 0
     or length(trim(coalesce(p_contact ->> 'mobile', ''))) = 0
     or length(trim(coalesce(p_contact ->> 'email', ''))) = 0 then
    raise exception 'Contact details and a pickup point are required';
  end if;

  v_seats_required := p_adults + p_children;
  select * into v_trip
  from public.trips
  where id = p_trip_id and status = 'approved'
  for update;
  if not found then
    raise exception 'Trip is unavailable';
  end if;
  if v_trip.seats_left < v_seats_required then
    raise exception 'Seats no longer available';
  end if;
  if p_payment_method = 'pay_later' and not v_trip.pay_at_pickup_allowed then
    raise exception 'Pay at pickup is not available for this trip';
  end if;
  if not exists (
    select 1 from public.trip_pickup_points
    where trip_id = p_trip_id and name = p_pickup
  ) then
    raise exception 'Choose a valid pickup point for this trip';
  end if;

  select count(*) into v_traveller_count
  from jsonb_array_elements(p_travellers) as traveller(value);
  if v_traveller_count <> p_adults + p_children + p_infants
     or (select count(*) from jsonb_array_elements(p_travellers) as traveller(value)
         where value ->> 'type' = 'adult') <> p_adults
     or (select count(*) from jsonb_array_elements(p_travellers) as traveller(value)
         where value ->> 'type' = 'child') <> p_children
     or (select count(*) from jsonb_array_elements(p_travellers) as traveller(value)
         where value ->> 'type' = 'infant') <> p_infants then
    raise exception 'Traveller details do not match the selected counts';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_travellers) as traveller(value)
    where value ->> 'type' not in ('adult', 'child', 'infant')
       or length(trim(coalesce(value ->> 'full_name', ''))) = 0
  ) then
    raise exception 'Every traveller needs a valid type and full name';
  end if;

  v_subtotal := round(
    (p_adults * v_trip.price_per_person)
    + (p_children * v_trip.price_per_person * v_child_price_percent / 100),
    2
  );
  if v_coupon_code is not null then
    select * into v_coupon
    from public.coupons
    where code = v_coupon_code and active
      and (valid_until is null or valid_until > now());
    if not found then
      raise exception 'Coupon is invalid or expired';
    end if;
    v_discount := round(v_subtotal * v_coupon.percent_off / 100, 2);
  end if;

  v_gst := round((v_subtotal - v_discount) * v_gst_percent, 2);
  v_total := v_subtotal - v_discount + v_gst + v_convenience_fee;
  if p_payment_method = 'pay_later' then
    v_amount_paid := 0;
  elsif p_partial then
    v_amount_paid := round(v_total * v_partial_payment_percent, 2);
  else
    v_amount_paid := v_total;
  end if;
  v_balance_due := v_total - v_amount_paid;
  v_booking_ref := 'HP-' || to_char(current_date, 'YYYY') || '-'
    || lpad(nextval('public.booking_ref_seq')::text, 6, '0');

  update public.trips
  set seats_left = seats_left - v_seats_required
  where id = p_trip_id;

  insert into public.bookings (
    booking_ref, user_id, trip_id, adults, children, infants,
    price_per_adult, child_price_percent, trip_snapshot,
    subtotal, discount, gst, convenience_fee, total, amount_paid, balance_due,
    status, payment_method, pickup_point, contact_name, contact_mobile,
    contact_email, emergency_name, emergency_relation, emergency_mobile,
    special_requests, coupon_code
  ) values (
    v_booking_ref, v_user_id, p_trip_id, p_adults, p_children, p_infants,
    v_trip.price_per_person, v_child_price_percent,
    jsonb_build_object(
      'id', v_trip.id, 'slug', v_trip.slug, 'title', v_trip.title,
      'destination', v_trip.destination, 'location', v_trip.location,
      'cover_image_path', v_trip.cover_image_path,
      'date_label', v_trip.date_label, 'duration_label', v_trip.duration_label
    ),
    v_subtotal, v_discount, v_gst, v_convenience_fee, v_total,
    v_amount_paid, v_balance_due,
    case when v_balance_due > 0 then 'Pending Payment' else 'Confirmed' end,
    p_payment_method, p_pickup,
    trim(p_contact ->> 'name'), trim(p_contact ->> 'mobile'),
    trim(p_contact ->> 'email'),
    coalesce(p_contact ->> 'emergency_name', ''),
    coalesce(p_contact ->> 'emergency_relation', ''),
    coalesce(p_contact ->> 'emergency_mobile', ''),
    coalesce(p_contact ->> 'special_requests', ''),
    v_coupon_code
  ) returning * into v_booking;

  insert into public.booking_travellers (
    booking_id, type, full_name, age, dob, gender, id_type, id_number
  )
  select
    v_booking.id,
    value ->> 'type',
    trim(value ->> 'full_name'),
    nullif(value ->> 'age', '')::integer,
    nullif(value ->> 'dob', '')::date,
    coalesce(value ->> 'gender', ''),
    coalesce(value ->> 'id_type', ''),
    coalesce(value ->> 'id_number', '')
  from jsonb_array_elements(p_travellers) as traveller(value);

  v_payment_status := case
    when v_amount_paid > 0 then 'paid'
    else 'pending'
  end;
  insert into public.payments (booking_id, provider, method, status, amount)
  values (v_booking.id, 'demo', p_payment_method, v_payment_status, v_amount_paid);

  delete from public.cart_items
  where user_id = v_user_id and trip_id = p_trip_id;

  return v_booking;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  select * into v_booking
  from public.bookings
  where id = p_booking_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.status in ('Cancelled', 'Completed') then
    raise exception 'This booking cannot be cancelled';
  end if;

  update public.trips
  set seats_left = least(seats_total, seats_left + v_booking.adults + v_booking.children)
  where id = v_booking.trip_id;
  update public.bookings
  set status = 'Cancelled', cancelled_at = now()
  where id = v_booking.id
  returning * into v_booking;
  return v_booking;
end;
$$;

drop trigger if exists auth_user_created_profile on auth.users;
create trigger auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

do $$
declare
  auth_user record;
  username_candidate text;
begin
  for auth_user in
    select id, email, raw_user_meta_data
    from auth.users
    order by created_at nulls first, id
  loop
    if not exists (select 1 from public.profiles where id = auth_user.id) then
      username_candidate := coalesce(
        nullif(trim(auth_user.raw_user_meta_data ->> 'username'), ''),
        nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
        'traveller'
      );
      if exists (
        select 1 from public.profiles
        where lower(username) = lower(username_candidate)
      ) then
        username_candidate := username_candidate || '-' || substr(auth_user.id::text, 1, 8);
      end if;
      insert into public.profiles (id, username, full_name, mobile)
      values (
        auth_user.id,
        username_candidate,
        coalesce(auth_user.raw_user_meta_data ->> 'full_name', ''),
        coalesce(auth_user.raw_user_meta_data ->> 'mobile', '')
      )
      on conflict (id) do nothing;
    end if;
  end loop;
end;
$$;

drop trigger if exists host_profile_guard_verification on public.host_profiles;
create trigger host_profile_guard_verification
before insert or update on public.host_profiles
for each row execute function public.guard_host_profile_verification();

drop trigger if exists trips_initialize_seats on public.trips;
create trigger trips_initialize_seats
before insert on public.trips
for each row execute function public.initialize_trip_seats();

drop trigger if exists trip_images_limit on public.trip_images;
create trigger trip_images_limit
before insert or update on public.trip_images
for each row execute function public.enforce_trip_image_limit();

drop trigger if exists reviews_refresh_trip_rating on public.reviews;
create trigger reviews_refresh_trip_rating
after insert or update or delete on public.reviews
for each row execute function public.refresh_trip_rating();

do $$
declare
  table_name text;
  updated_tables text[] := array[
    'profiles', 'host_profiles', 'trips', 'trip_images',
    'trip_itinerary_days', 'trip_inclusions', 'trip_pickup_points',
    'wishlist_items', 'cart_items', 'coupons', 'bookings',
    'booking_travellers', 'payments', 'reviews', 'custom_trip_requests',
    'contact_messages', 'newsletter_subscribers'
  ];
begin
  foreach table_name in array updated_tables loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.host_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_images enable row level security;
alter table public.trip_itinerary_days enable row level security;
alter table public.trip_inclusions enable row level security;
alter table public.trip_pickup_points enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.cart_items enable row level security;
alter table public.coupons enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_travellers enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.custom_trip_requests enable row level security;
alter table public.contact_messages enable row level security;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists host_profiles_public_read on public.host_profiles;
create policy host_profiles_public_read on public.host_profiles
for select to anon, authenticated using (true);

drop policy if exists host_profiles_owner_write on public.host_profiles;
create policy host_profiles_owner_write on public.host_profiles
for all to authenticated
using (id = auth.uid() and public.is_host())
with check (id = auth.uid() and public.is_host());

drop policy if exists host_profiles_admin_all on public.host_profiles;
create policy host_profiles_admin_all on public.host_profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists trips_read_published_owner_admin on public.trips;
create policy trips_read_published_owner_admin on public.trips
for select to anon, authenticated
using (status = 'approved' or host_id = auth.uid() or public.is_admin());

drop policy if exists trips_host_insert on public.trips;
create policy trips_host_insert on public.trips
for insert to authenticated
with check (
  host_id = auth.uid()
  and status in ('draft', 'pending')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'host')
);

drop policy if exists trips_host_update on public.trips;
create policy trips_host_update on public.trips
for update to authenticated
using (
  host_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'host')
)
with check (
  host_id = auth.uid()
  and status in ('draft', 'pending')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'host')
);

drop policy if exists trips_admin_all on public.trips;
create policy trips_admin_all on public.trips
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists trip_images_read_accessible_trip on public.trip_images;
create policy trip_images_read_accessible_trip on public.trip_images
for select to anon, authenticated using (public.can_access_trip(trip_id));
drop policy if exists trip_images_host_write on public.trip_images;
create policy trip_images_host_write on public.trip_images
for all to authenticated
using (public.is_host_of_trip(trip_id))
with check (public.is_host_of_trip(trip_id));
drop policy if exists trip_images_admin_all on public.trip_images;
create policy trip_images_admin_all on public.trip_images
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists itinerary_read_accessible_trip on public.trip_itinerary_days;
create policy itinerary_read_accessible_trip on public.trip_itinerary_days
for select to anon, authenticated using (public.can_access_trip(trip_id));
drop policy if exists itinerary_host_write on public.trip_itinerary_days;
create policy itinerary_host_write on public.trip_itinerary_days
for all to authenticated
using (public.is_host_of_trip(trip_id))
with check (public.is_host_of_trip(trip_id));
drop policy if exists itinerary_admin_all on public.trip_itinerary_days;
create policy itinerary_admin_all on public.trip_itinerary_days
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists inclusions_read_accessible_trip on public.trip_inclusions;
create policy inclusions_read_accessible_trip on public.trip_inclusions
for select to anon, authenticated using (public.can_access_trip(trip_id));
drop policy if exists inclusions_host_write on public.trip_inclusions;
create policy inclusions_host_write on public.trip_inclusions
for all to authenticated
using (public.is_host_of_trip(trip_id))
with check (public.is_host_of_trip(trip_id));
drop policy if exists inclusions_admin_all on public.trip_inclusions;
create policy inclusions_admin_all on public.trip_inclusions
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists pickups_read_accessible_trip on public.trip_pickup_points;
create policy pickups_read_accessible_trip on public.trip_pickup_points
for select to anon, authenticated using (public.can_access_trip(trip_id));
drop policy if exists pickups_host_write on public.trip_pickup_points;
create policy pickups_host_write on public.trip_pickup_points
for all to authenticated
using (public.is_host_of_trip(trip_id))
with check (public.is_host_of_trip(trip_id));
drop policy if exists pickups_admin_all on public.trip_pickup_points;
create policy pickups_admin_all on public.trip_pickup_points
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists wishlist_owner_all on public.wishlist_items;
create policy wishlist_owner_all on public.wishlist_items
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists cart_owner_all on public.cart_items;
create policy cart_owner_all on public.cart_items
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists coupons_read_active on public.coupons;
create policy coupons_read_active on public.coupons
for select to anon, authenticated
using (active and (valid_until is null or valid_until > now()));
drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists bookings_read_owner_host_admin on public.bookings;
create policy bookings_read_owner_host_admin on public.bookings
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_host_of_trip(trip_id)
  or public.is_admin()
);
drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists booking_travellers_read_owner_admin on public.booking_travellers;
create policy booking_travellers_read_owner_admin on public.booking_travellers
for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.user_id = auth.uid() or public.is_admin())
  )
);
drop policy if exists booking_travellers_admin_all on public.booking_travellers;
create policy booking_travellers_admin_all on public.booking_travellers
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists payments_read_owner_admin on public.payments;
create policy payments_read_owner_admin on public.payments
for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and (b.user_id = auth.uid() or public.is_admin())
  )
);
drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all on public.payments
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
for select to anon, authenticated using (true);
drop policy if exists reviews_insert_confirmed_booking on public.reviews;
create policy reviews_insert_confirmed_booking on public.reviews
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.user_id = auth.uid()
      and b.trip_id = reviews.trip_id
      and b.status = 'Confirmed'
  )
);
drop policy if exists reviews_update_owner_confirmed_booking on public.reviews;
create policy reviews_update_owner_confirmed_booking on public.reviews
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.user_id = auth.uid()
      and b.trip_id = reviews.trip_id
      and b.status = 'Confirmed'
  )
);
drop policy if exists reviews_delete_owner on public.reviews;
create policy reviews_delete_owner on public.reviews
for delete to authenticated using (user_id = auth.uid());
drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists custom_trip_requests_insert on public.custom_trip_requests;
create policy custom_trip_requests_insert on public.custom_trip_requests
for insert to anon, authenticated
with check (user_id is null or user_id = auth.uid());
drop policy if exists custom_trip_requests_admin_read on public.custom_trip_requests;
create policy custom_trip_requests_admin_read on public.custom_trip_requests
for select to authenticated using (public.is_admin());
drop policy if exists custom_trip_requests_admin_update on public.custom_trip_requests;
create policy custom_trip_requests_admin_update on public.custom_trip_requests
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists contact_messages_insert_only on public.contact_messages;
create policy contact_messages_insert_only on public.contact_messages
for insert to anon, authenticated with check (true);
drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages
for select to authenticated using (public.is_admin());
drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update on public.contact_messages
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists newsletter_subscribers_insert_only on public.newsletter_subscribers;
create policy newsletter_subscribers_insert_only on public.newsletter_subscribers
for insert to anon, authenticated with check (true);
drop policy if exists newsletter_subscribers_admin_read on public.newsletter_subscribers;
create policy newsletter_subscribers_admin_read on public.newsletter_subscribers
for select to authenticated using (public.is_admin());
drop policy if exists newsletter_subscribers_admin_update on public.newsletter_subscribers;
create policy newsletter_subscribers_admin_update on public.newsletter_subscribers
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_host() to anon, authenticated;
grant execute on function public.is_host_of_trip(uuid) to anon, authenticated;
grant execute on function public.can_access_trip(uuid) to anon, authenticated;
revoke all on function public.create_booking(uuid, integer, integer, integer, jsonb, jsonb, text, text, text, boolean)
  from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.create_booking(uuid, integer, integer, integer, jsonb, jsonb, text, text, text, boolean)
  to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;

grant select on public.host_profiles, public.trips, public.trip_images,
  public.trip_itinerary_days, public.trip_inclusions, public.trip_pickup_points,
  public.reviews, public.coupons to anon, authenticated;
grant select on public.profiles, public.wishlist_items, public.cart_items,
  public.bookings, public.booking_travellers, public.payments,
  public.custom_trip_requests, public.contact_messages,
  public.newsletter_subscribers to authenticated;

grant update (username, full_name, mobile) on public.profiles to authenticated;
grant insert, update, delete on public.host_profiles to authenticated;

grant insert (
  host_id, slug, title, destination, location, short_description, description,
  tag, cover_image_path, price_per_person, start_date, end_date, date_label,
  duration_label, seats_total, min_group, max_group, difficulty,
  pay_at_pickup_allowed, cancellation_policy, status
) on public.trips to authenticated;
grant update (
  slug, title, destination, location, short_description, description, tag,
  cover_image_path, price_per_person, start_date, end_date, date_label,
  duration_label, seats_total, min_group, max_group, difficulty,
  pay_at_pickup_allowed, cancellation_policy, status
) on public.trips to authenticated;
grant delete on public.trips to authenticated;

grant insert, update, delete on public.trip_images, public.trip_itinerary_days,
  public.trip_inclusions, public.trip_pickup_points to authenticated;
grant insert, update, delete on public.wishlist_items, public.cart_items to authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant insert on public.custom_trip_requests, public.contact_messages,
  public.newsletter_subscribers to anon, authenticated;
grant update, delete on public.custom_trip_requests, public.contact_messages,
  public.newsletter_subscribers to authenticated;
grant insert, update, delete on public.coupons to authenticated;

revoke insert, update, delete on public.bookings, public.booking_travellers,
  public.payments from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke update, delete on public.trips from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-images', 'trip-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists trip_images_public_read on storage.objects;
create policy trip_images_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'trip-images');

drop policy if exists trip_images_upload_own_folder on storage.objects;
create policy trip_images_upload_own_folder on storage.objects
for insert to authenticated
with check (
  bucket_id = 'trip-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists trip_images_update_own_folder on storage.objects;
create policy trip_images_update_own_folder on storage.objects
for update to authenticated
using (
  bucket_id = 'trip-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'trip-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists trip_images_delete_own_folder on storage.objects;
create policy trip_images_delete_own_folder on storage.objects
for delete to authenticated
using (
  bucket_id = 'trip-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
