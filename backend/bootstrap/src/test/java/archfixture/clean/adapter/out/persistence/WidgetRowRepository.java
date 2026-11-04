package archfixture.clean.adapter.out.persistence;

import java.util.UUID;
import org.springframework.data.repository.Repository;

interface WidgetRowRepository extends Repository<WidgetRow, UUID> {
}
