package archfixture.clean.adapter.out.persistence.jooq;

import org.jooq.Condition;
import org.jooq.impl.DSL;

/** Stands in for a generated jOOQ table class: public, and free to use jOOQ's plain-SQL API. */
public class Widgets {

    public Condition where(String condition) {
        return DSL.condition(condition);
    }
}
