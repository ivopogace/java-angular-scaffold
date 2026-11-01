package archfixture.clean.application.service;

import archfixture.clean.application.port.in.CreateWidget;
import archfixture.clean.application.port.out.WidgetRepository;
import archfixture.clean.domain.id.WidgetId;
import archfixture.clean.domain.model.Widget;
import io.scaffold.starter.shared.UseCase;

@UseCase
class CreateWidgetService implements CreateWidget {

    private final WidgetRepository widgets;

    CreateWidgetService(WidgetRepository widgets) {
        this.widgets = widgets;
    }

    @Override
    public WidgetId create() {
        Widget widget = new Widget();
        widgets.save(widget);
        return widget.id();
    }
}
