-- Allow an admin to move one hour out of a multi-hour booking block.
-- The API calls this as service_role so the split and move are atomic.
create or replace function reschedule_booking_hour(
  p_booking_id uuid,
  p_expected_date date,
  p_expected_start_time time,
  p_expected_end_time time,
  p_source_start_hour integer,
  p_new_court_id integer,
  p_new_date date,
  p_new_start_hour integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking bookings%rowtype;
  v_source_start time;
  v_source_end time;
  v_new_start time;
  v_new_end time;
  v_start_hour integer;
  v_end_hour integer;
  v_hour_amount numeric;
begin
  select *
    into v_booking
    from bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;

  if v_booking.booking_date <> p_expected_date
     or v_booking.start_time <> p_expected_start_time
     or v_booking.end_time <> p_expected_end_time then
    raise exception 'Booking changed before it could be moved.' using errcode = '40001';
  end if;

  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'Only pending or confirmed bookings can be rescheduled.';
  end if;

  if p_source_start_hour < 0 or p_source_start_hour > 23
     or p_new_start_hour < 9 or p_new_start_hour > 23 then
    raise exception 'Invalid booking hour.';
  end if;

  v_start_hour := extract(hour from v_booking.start_time)::integer;
  v_end_hour := case
    when v_booking.end_time = time '24:00' or v_booking.end_time = time '00:00' then 24
    else extract(hour from v_booking.end_time)::integer
  end;

  v_source_start := make_time(p_source_start_hour, 0, 0);
  v_source_end := case
    when p_source_start_hour = 23 then time '24:00'
    else make_time(p_source_start_hour + 1, 0, 0)
  end;

  if p_source_start_hour < v_start_hour or p_source_start_hour + 1 > v_end_hour then
    raise exception 'Selected hour is outside this booking.';
  end if;

  v_new_start := make_time(p_new_start_hour, 0, 0);
  v_new_end := case
    when p_new_start_hour = 23 then time '24:00'
    else make_time(p_new_start_hour + 1, 0, 0)
  end;
  v_hour_amount := v_booking.amount / (v_end_hour - v_start_hour);

  delete from bookings where id = p_booking_id;

  -- Keep the original ID on the moved hour; the remaining pieces get new IDs.
  insert into bookings (
    id, court_id, user_id, guest_name, guest_phone, guest_email,
    booking_date, start_time, end_time, status, payment_status, amount,
    payment_reference, created_at, booking_group_id, receipt_path,
    receipt_hash, risk_flags, rejection_reason, reference_code
  ) values (
    v_booking.id, p_new_court_id, v_booking.user_id, v_booking.guest_name,
    v_booking.guest_phone, v_booking.guest_email, p_new_date, v_new_start,
    v_new_end, v_booking.status, v_booking.payment_status, v_hour_amount,
    v_booking.payment_reference, v_booking.created_at, v_booking.booking_group_id,
    v_booking.receipt_path, v_booking.receipt_hash, v_booking.risk_flags,
    v_booking.rejection_reason, v_booking.reference_code
  );

  if v_booking.start_time < v_source_start then
    insert into bookings (
      court_id, user_id, guest_name, guest_phone, guest_email,
      booking_date, start_time, end_time, status, payment_status, amount,
      payment_reference, created_at, booking_group_id, receipt_path,
      receipt_hash, risk_flags, rejection_reason, reference_code
    ) values (
      v_booking.court_id, v_booking.user_id, v_booking.guest_name,
      v_booking.guest_phone, v_booking.guest_email, v_booking.booking_date,
      v_booking.start_time, v_source_start, v_booking.status,
      v_booking.payment_status, v_hour_amount * (p_source_start_hour - v_start_hour),
      v_booking.payment_reference, v_booking.created_at, v_booking.booking_group_id,
      v_booking.receipt_path, v_booking.receipt_hash, v_booking.risk_flags,
      v_booking.rejection_reason, v_booking.reference_code
    );
  end if;

  if v_source_end < v_booking.end_time then
    insert into bookings (
      court_id, user_id, guest_name, guest_phone, guest_email,
      booking_date, start_time, end_time, status, payment_status, amount,
      payment_reference, created_at, booking_group_id, receipt_path,
      receipt_hash, risk_flags, rejection_reason, reference_code
    ) values (
      v_booking.court_id, v_booking.user_id, v_booking.guest_name,
      v_booking.guest_phone, v_booking.guest_email, v_booking.booking_date,
      v_source_end, v_booking.end_time, v_booking.status,
      v_booking.payment_status, v_hour_amount * (v_end_hour - p_source_start_hour - 1),
      v_booking.payment_reference, v_booking.created_at, v_booking.booking_group_id,
      v_booking.receipt_path, v_booking.receipt_hash, v_booking.risk_flags,
      v_booking.rejection_reason, v_booking.reference_code
    );
  end if;
end;
$$;

revoke all on function reschedule_booking_hour(uuid, date, time, time, integer, integer, date, integer)
  from public, anon, authenticated;
grant execute on function reschedule_booking_hour(uuid, date, time, time, integer, integer, date, integer)
  to service_role;
