-- Optimistic locking: an update sets version = version + 1 where the version it loaded still holds.
alter table catalog_product
    add column version bigint not null default 0 check (version >= 0);
