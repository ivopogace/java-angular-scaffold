package archfixture.orders.domain.event;

import java.time.Instant;

public record OrderShipped(Instant shippedAt) {

    public boolean isLate(Instant due) {
        return shippedAt.isAfter(due);
    }
}
