package archfixture.clean.adapter.out.persistence;

import java.util.List;
import org.jooq.Condition;
import org.jooq.impl.DSL;
import org.springframework.jdbc.core.simple.JdbcClient;

class WidgetSearch {

    private final JdbcClient jdbc;

    WidgetSearch(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    List<String> namesMatching(String text) {
        return jdbc.sql("select name from clean_widget where search @@ plainto_tsquery(:text)")
                .param("text", text)
                .query(String.class)
                .list();
    }

    Condition matching(String text) {
        return DSL.condition("search @@ plainto_tsquery({0})", text);
    }
}
