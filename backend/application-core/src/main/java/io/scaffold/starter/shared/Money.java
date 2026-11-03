package io.scaffold.starter.shared;

import java.util.Currency;
import java.util.Objects;
import org.jmolecules.ddd.annotation.ValueObject;

/** Arithmetic fails with {@link ArithmeticException} instead of wrapping. */
@ValueObject
public record Money(long amountMinor, Currency currency) {

    public Money {
        Objects.requireNonNull(currency, "currency");
    }

    public static Money of(long amountMinor, String currencyCode) {
        return new Money(amountMinor, Currency.getInstance(currencyCode));
    }

    /** @throws IllegalArgumentException if the currencies differ */
    public Money plus(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException(
                    "Cannot add " + other.currency + " to " + currency);
        }
        return new Money(Math.addExact(amountMinor, other.amountMinor), currency);
    }
}
