begin;

alter table public.family_data
drop constraint if exists family_data_data_type_check;

alter table public.family_data
add constraint family_data_data_type_check
check (
  data_type = any (
    array[
      'member'::text,
      'contact'::text,
      'emergency_contact'::text,
      'preference'::text,
      'allergy'::text,
      'restriction'::text,
      'custody_config'::text,
      'custody_exception'::text,
      'location_config'::text
    ]
  )
);

commit;
