package io.scaffold.starter.codegen;

import org.jooq.codegen.DefaultGeneratorStrategy;
import org.jooq.meta.Definition;

/** Puts every generated class of an area in its one target package, which the area package shape allows. */
public final class FlatPackageStrategy extends DefaultGeneratorStrategy {

    @Override
    public String getJavaPackageName(Definition definition, Mode mode) {
        return getTargetPackage();
    }
}
