alter table catalog_product
    add column version bigint not null default 0 check (version >= 0);
