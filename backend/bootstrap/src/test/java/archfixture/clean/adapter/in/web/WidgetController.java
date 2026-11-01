package archfixture.clean.adapter.in.web;

import archfixture.clean.application.port.in.CreateWidget;

public class WidgetController {

    private final CreateWidget createWidget;

    public WidgetController(CreateWidget createWidget) {
        this.createWidget = createWidget;
    }

    public String create() {
        return createWidget.create().value().toString();
    }
}
