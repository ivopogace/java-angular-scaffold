package archfixture.clean.domain.model;

import archfixture.clean.domain.id.WidgetId;
import java.util.UUID;

public class Widget {

    private final WidgetId id = new WidgetId(UUID.randomUUID());
    private final byte[] payload = new byte[0];

    public WidgetId id() {
        return id;
    }

    public byte[] payload() {
        return payload.clone();
    }

    public String[] tags() {
        return new String[0];
    }

    public WidgetId[] ids() {
        return new WidgetId[] {id};
    }
}
