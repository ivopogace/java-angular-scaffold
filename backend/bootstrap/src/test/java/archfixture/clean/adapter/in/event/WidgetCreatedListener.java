package archfixture.clean.adapter.in.event;

import archfixture.clean.application.port.in.CreateWidget;
import archfixture.clean.domain.event.WidgetCreated;
import archfixture.clean.domain.id.WidgetId;

class WidgetCreatedListener {

    private final CreateWidget createWidget;

    WidgetCreatedListener(CreateWidget createWidget) {
        this.createWidget = createWidget;
    }

    WidgetId on(WidgetCreated event) {
        createWidget.create();
        return event.id();
    }
}
