package archfixture.clean.application.port.out;

import archfixture.clean.domain.model.Widget;

public interface WidgetRepository {

    void save(Widget widget);
}
