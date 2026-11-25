-- seed_old_site
-- What operationkokua.weebly.com already states, as one real batch: the 12
-- trips (same slugs as src/content/trips.ts) and the 4 hospitals it names.
-- No items, values or dates beyond what the old site prints.
--
-- Verification (must print pass):
--   select case when
--     (select count(*) from public.import_batches where label = 'old-site' and kind = 'real') = 1
--     and (select count(*) from public.trips) = 12
--     and (select count(*) from public.recipients) = 4
--   then 'pass' else 'FAIL' end as seed_old_site;

with batch as (
  insert into public.import_batches (kind, label, source_filename, received_from, received_on, note, created_by)
  values ('real', 'old-site', 'operationkokua.weebly.com', 'public website', date '2026-11-24',
          'Mirror of the old site taken 2026-11-24 (HST). Trips and hospitals only.', 'migration')
  returning id
),
t as (
  insert into public.trips (batch_id, slug, title, year, month, city, country)
  select batch.id, v.slug, v.title, v.year, v.month, v.city, v.country
  from batch, (values
    ('cambodia-2015', 'Cambodia, December 2015', 2015, 12, 'Phnom Penh', 'Cambodia'),
    ('hanoi-2015', 'Hanoi, November 2015', 2015, 11, 'Hanoi', 'Vietnam'),
    ('ho-chi-minh-city-2015', 'Ho Chi Minh City, November 2015', 2015, 11, 'Ho Chi Minh City', 'Vietnam'),
    ('vinh-city-2015', 'Vinh City, Vietnam, November 2015', 2015, 11, 'Vinh City', 'Vietnam'),
    ('ho-chi-minh-city-2014', 'Ho Chi Minh City, 2014', 2014, 11, 'Ho Chi Minh City', 'Vietnam'),
    ('cambodia-2014', 'Cambodia, November 2014', 2014, 11, 'Phnom Penh', 'Cambodia'),
    ('da-lat-2014', 'Da Lat, 2014', 2014, null, 'Da Lat', 'Vietnam'),
    ('cambodia-2013', 'Cambodia, 2013', 2013, null, 'Phnom Penh', 'Cambodia'),
    ('ho-chi-minh-city-2013', 'Ho Chi Minh City, 2013', 2013, 11, 'Ho Chi Minh City', 'Vietnam'),
    ('dalat-2013', 'DaLat Vietnam, 2013', 2013, null, 'DaLat', 'Vietnam'),
    ('hanoi-bac-ninh-2013', 'Hanoi / Bac Ninh, 2013', 2013, null, 'Hanoi / Bac Ninh', 'Vietnam'),
    ('hanoi-2010', 'Hanoi, 2010', 2010, null, 'Hanoi', 'Vietnam')
  ) as v (slug, title, year, month, city, country)
  returning slug
),
r as (
  insert into public.recipients (batch_id, name, department, city, country)
  select batch.id, v.name, v.department, v.city, v.country
  from batch, (values
    ('Cho Ray Hospital', 'Neurosurgery', 'Ho Chi Minh City', 'Vietnam'),
    ('Hospital 108', null, 'Hanoi', 'Vietnam'),
    ('Hanoi Military Hospital 103', null, 'Hanoi', 'Vietnam'),
    ('Preah Kossamak Hospital', null, 'Phnom Penh', 'Cambodia')
  ) as v (name, department, city, country)
  returning name
)
select (select count(*) from t) as trips, (select count(*) from r) as recipients;
