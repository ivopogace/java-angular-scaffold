create table catalog_product (
    id             uuid primary key,
    name           text        not null check (char_length(name) between 1 and 120),
    price_minor    bigint      check (price_minor >= 0),
    price_currency char(3),
    status         text        not null check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
    published_at   timestamptz,
    check ((price_minor is null) = (price_currency is null))
);

create table catalog_publication_log (
    product_id   uuid        primary key references catalog_product (id),
    published_at timestamptz not null
);
