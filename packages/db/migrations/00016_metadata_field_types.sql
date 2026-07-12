-- Extend metadata_schemas.field_type for Phase 07 property types

alter table metadata_schemas
  drop constraint if exists metadata_schemas_field_type_check;

alter table metadata_schemas
  add constraint metadata_schemas_field_type_check
  check (
    field_type in (
      'text',
      'textarea',
      'select',
      'multi_select',
      'date',
      'date_range',
      'tags',
      'number',
      'url',
      'checkbox'
    )
  );
