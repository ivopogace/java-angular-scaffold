package archfixture.clean.domain.model;

import archfixture.clean.domain.id.WidgetId;
import java.util.UUID;

public class Widget {

    private final WidgetId id = new WidgetId(UUID.randomUUID());

    public WidgetId id() {
        return id;
    }
}
