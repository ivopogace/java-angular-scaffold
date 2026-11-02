package archfixture.clean.application.port.in;

import archfixture.clean.domain.id.WidgetId;
import java.util.Objects;

public record WidgetView(WidgetId id, String label) {

    public WidgetView {
        Objects.requireNonNull(id, () -> "id");
    }

    public static WidgetView unlabelled(WidgetId id) {
        return new WidgetView(id, "");
    }

    @Override
    public String toString() {
        return "WidgetView[" + id + "]";
    }
}
