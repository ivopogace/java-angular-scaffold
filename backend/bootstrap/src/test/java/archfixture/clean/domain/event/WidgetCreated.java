package archfixture.clean.domain.event;

import archfixture.clean.domain.id.WidgetId;
import org.jmolecules.event.types.DomainEvent;

public record WidgetCreated(WidgetId id) implements DomainEvent {
}
