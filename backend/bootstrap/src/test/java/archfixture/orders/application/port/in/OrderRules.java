package archfixture.orders.application.port.in;

public record OrderRules() {

    public static boolean canCancel(SmartOrderView view) {
        return view.state().equals("PLACED");
    }
}
