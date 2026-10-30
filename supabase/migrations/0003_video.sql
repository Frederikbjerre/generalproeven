-- Kampagnevideoer som materiale. Selve videoen og stillbillederne gemmes ikke –
-- kun tekstbeskrivelsen (filnavn, længde, manuskript) i input_text / variant_b_text.

alter table public.tests drop constraint if exists tests_input_type_check;
alter table public.tests add constraint tests_input_type_check
  check (input_type in ('text', 'url', 'video'));

alter table public.tests drop constraint if exists tests_variant_b_input_type_check;
alter table public.tests add constraint tests_variant_b_input_type_check
  check (variant_b_input_type in ('text', 'url', 'video'));
