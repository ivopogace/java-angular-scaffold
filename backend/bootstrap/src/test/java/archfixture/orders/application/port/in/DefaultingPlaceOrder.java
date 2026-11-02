package archfixture.orders.application.port.in;

public interface DefaultingPlaceOrder {

    void place();

    default void placeTwice() {
        place();
        place();
    }
}
