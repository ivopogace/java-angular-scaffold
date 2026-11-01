package io.scaffold.starter.shared;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Currency;
import org.junit.jupiter.api.Test;

class MoneyTest {

    @Test
    void ofHoldsMinorUnitsAndCurrency() {
        Money money = Money.of(1250, "EUR");

        assertThat(money.amountMinor()).isEqualTo(1250);
        assertThat(money.currency()).isEqualTo(Currency.getInstance("EUR"));
    }

    @Test
    void plusSumsSameCurrency() {
        assertThat(Money.of(1250, "EUR").plus(Money.of(50, "EUR"))).isEqualTo(Money.of(1300, "EUR"));
    }

    @Test
    void plusRejectsDifferentCurrencies() {
        Money eur = Money.of(100, "EUR");
        Money usd = Money.of(100, "USD");

        assertThatThrownBy(() -> eur.plus(usd)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void nullCurrencyIsRejected() {
        assertThatThrownBy(() -> new Money(100, null)).isInstanceOf(NullPointerException.class);
    }
}
