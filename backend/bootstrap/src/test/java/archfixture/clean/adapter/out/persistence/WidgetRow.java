package archfixture.clean.adapter.out.persistence;

import java.util.UUID;
import org.springframework.data.annotation.Id;

record WidgetRow(@Id UUID id) {
}
