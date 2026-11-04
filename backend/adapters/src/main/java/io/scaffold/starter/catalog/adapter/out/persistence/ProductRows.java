package io.scaffold.starter.catalog.adapter.out.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

/** Reads only: writes go through {@code JdbcAggregateTemplate.insert} / {@code update}, since the domain assigns ids. */
interface ProductRows extends Repository<ProductRow, UUID> {

    Optional<ProductRow> findById(UUID id);

    List<ProductRow> findAll();

    boolean existsById(UUID id);
}
