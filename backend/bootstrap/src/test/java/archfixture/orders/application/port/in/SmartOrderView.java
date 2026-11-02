package archfixture.orders.application.port.in;

public record SmartOrderView(String state) {

    public boolean canCancel() {
        return state.equals("PLACED");
    }
}
