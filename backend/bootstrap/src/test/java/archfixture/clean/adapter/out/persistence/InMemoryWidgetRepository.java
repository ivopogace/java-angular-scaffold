package archfixture.clean.adapter.out.persistence;

import archfixture.clean.application.port.out.WidgetRepository;
import archfixture.clean.domain.id.WidgetId;
import archfixture.clean.domain.model.Widget;

class InMemoryWidgetRepository implements WidgetRepository {

    @Override
    public void save(Widget widget) {
    }

    @Override
    public Widget findById(WidgetId id) {
        return Widget.rehydrate(id);
    }
}
