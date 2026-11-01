package archfixture.clean.adapter.out.persistence;

import archfixture.clean.application.port.out.WidgetRepository;
import archfixture.clean.domain.model.Widget;

public class InMemoryWidgetRepository implements WidgetRepository {

    @Override
    public void save(Widget widget) {
    }
}
