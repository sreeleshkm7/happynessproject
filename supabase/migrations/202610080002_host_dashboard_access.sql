create or replace function public.initialize_trip_seats()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_host() and not public.is_admin() then
    new.seats_left := new.seats_total;
  elsif new.seats_left = 0 then
    new.seats_left := new.seats_total;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_host_seat_edits()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and public.is_host()
     and not public.is_admin()
     and current_user <> 'postgres'
  then
    if old.status not in ('draft', 'pending') then
      raise exception 'Hosts cannot edit trips that are no longer pending approval';
    end if;
    if new.seats_total is distinct from old.seats_total then
      new.seats_left := new.seats_total;
    elsif new.seats_left is distinct from old.seats_left then
      raise exception 'Hosts cannot change remaining seats directly';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists trips_host_update on public.trips;
create policy trips_host_update on public.trips
for update to authenticated
using (
  host_id = auth.uid()
  and status in ('draft', 'pending')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'host')
)
with check (
  host_id = auth.uid()
  and status in ('draft', 'pending')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'host')
);

drop policy if exists trip_images_host_write on public.trip_images;
create policy trip_images_host_write on public.trip_images
for all to authenticated
using (
  public.is_host_of_trip(trip_id)
  and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.status in ('draft', 'pending')
  )
)
with check (
  public.is_host_of_trip(trip_id)
  and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.status in ('draft', 'pending')
  )
);

drop policy if exists itinerary_host_write on public.trip_itinerary_days;
create policy itinerary_host_write on public.trip_itinerary_days
for all to authenticated
using (
  public.is_host_of_trip(trip_id)
  and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.status in ('draft', 'pending')
  )
)
with check (
  public.is_host_of_trip(trip_id)
  and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.status in ('draft', 'pending')
  )
);

drop policy if exists inclusions_host_write on public.trip_inclusions;
create policy inclusions_host_write on public.trip_inclusions
for all to authenticated
using (
  public.is_host_of_trip(trip_id)
  and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.status in ('draft', 'pending')
  )
)
with check (
  public.is_host_of_trip(trip_id)
  and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.status in ('draft', 'pending')
  )
);

drop policy if exists pickups_host_write on public.trip_pickup_points;
create policy pickups_host_write on public.trip_pickup_points
for all to authenticated
using (
  public.is_host_of_trip(trip_id)
  and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.status in ('draft', 'pending')
  )
)
with check (
  public.is_host_of_trip(trip_id)
  and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.status in ('draft', 'pending')
  )
);

drop trigger if exists trips_host_seat_guard on public.trips;
create trigger trips_host_seat_guard
before update on public.trips
for each row execute function public.prevent_host_seat_edits();

drop policy if exists booking_travellers_host_read on public.booking_travellers;
create policy booking_travellers_host_read on public.booking_travellers
for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and public.is_host_of_trip(b.trip_id)
  )
);
