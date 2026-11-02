package archfixture.clean.application.port.in;

public sealed interface RenameOutcome {

    enum Reason {
        TAKEN,
        TOO_LONG
    }

    record Renamed(WidgetView widget) implements RenameOutcome {
    }

    record Rejected(Reason reason) implements RenameOutcome {
    }
}
