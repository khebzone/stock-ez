package com.stockez.api.module.goodsreturn;

import jakarta.persistence.Entity;
import org.hibernate.SessionFactory;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.query.spi.QueryEngine;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Parses every @Query in the application as JPQL.
 *
 * A malformed @Query is not an ordinary bug — Spring Data validates queries while creating the
 * repository beans, so it stops the application from starting at all. That makes it exactly the kind
 * of mistake worth catching before a deploy rather than during one.
 *
 * No database is involved: Hibernate builds the entity metamodel from an explicit dialect with JDBC
 * metadata access switched off, and parses HQL into its semantic model without opening a connection.
 * Entities and repositories are discovered off the compiled output so the test cannot drift as
 * modules are added.
 */
class GoodsReturnQueryParseTest {

    private static final Path CLASSES = Paths.get("target", "classes");
    private static final String ROOT_PACKAGE = "com.stockez";

    private static StandardServiceRegistry registry;
    private static SessionFactory sessionFactory;

    @BeforeAll
    static void bootMetamodel() throws IOException {
        registry = new StandardServiceRegistryBuilder()
                .applySetting(AvailableSettings.DIALECT, "org.hibernate.dialect.PostgreSQLDialect")
                .applySetting("hibernate.boot.allow_jdbc_metadata_access", "false")
                .applySetting(AvailableSettings.HBM2DDL_AUTO, "none")
                .build();

        MetadataSources sources = new MetadataSources(registry);
        List<Class<?>> entities = scanFor(Entity.class);
        assertFalse(entities.isEmpty(), "no @Entity classes found under " + CLASSES.toAbsolutePath());
        entities.forEach(sources::addAnnotatedClass);

        sessionFactory = sources.buildMetadata().buildSessionFactory();
    }

    @AfterAll
    static void shutdown() {
        if (sessionFactory != null) sessionFactory.close();
        if (registry != null) StandardServiceRegistryBuilder.destroy(registry);
    }

    @Test
    @DisplayName("every @Query in the application is valid JPQL")
    void queriesParse() throws IOException {
        QueryEngine engine = sessionFactory.unwrap(SessionFactoryImplementor.class).getQueryEngine();

        List<String> failures = new ArrayList<>();
        int parsed = 0;

        for (Class<?> repository : scanFor(null)) {
            if (!Repository.class.isAssignableFrom(repository)) continue;
            for (Method method : repository.getMethods()) {
                Query query = method.getAnnotation(Query.class);
                if (query == null || query.nativeQuery() || query.value().isBlank()) continue;
                try {
                    engine.getHqlTranslator().translate(query.value(), null);
                    parsed++;
                } catch (RuntimeException e) {
                    failures.add(repository.getSimpleName() + "." + method.getName()
                            + "\n      " + e.getMessage());
                }
            }
        }

        if (!failures.isEmpty()) {
            fail("Invalid JPQL — the application would fail to start:\n    "
                    + String.join("\n    ", failures));
        }
        assertFalse(parsed == 0, "no @Query methods were found — the test is not checking anything");
        System.out.println("Parsed " + parsed + " @Query definitions as JPQL");
    }

    /**
     * Keeps the check above honest. If the translator ever stopped rejecting bad input — a changed
     * Hibernate API, a swallowed exception — the main test would pass while checking nothing.
     */
    @Test
    @DisplayName("the parser rejects a query naming a column that does not exist")
    void parserActuallyRejectsBadQuery() {
        QueryEngine engine = sessionFactory.unwrap(SessionFactoryImplementor.class).getQueryEngine();
        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, () ->
                engine.getHqlTranslator().translate(
                        "SELECT g FROM GoodsReturn g WHERE g.noSuchColumn = 'X'", null));
    }

    /** Loads compiled classes under the root package; with an annotation, keeps only those carrying it. */
    private static List<Class<?>> scanFor(Class<? extends java.lang.annotation.Annotation> annotation)
            throws IOException {
        Path root = CLASSES.resolve(ROOT_PACKAGE.replace('.', '/'));
        if (!Files.isDirectory(root)) {
            fail("compiled classes not found at " + root.toAbsolutePath() + " — run compile first");
        }
        List<Class<?>> found = new ArrayList<>();
        try (Stream<Path> files = Files.walk(root)) {
            for (Path file : files.filter(p -> p.toString().endsWith(".class")).toList()) {
                String name = CLASSES.relativize(file).toString()
                        .replace('\\', '.').replace('/', '.')
                        .replaceAll("\\.class$", "");
                if (name.contains("$")) continue;
                Class<?> type;
                try {
                    type = Class.forName(name, false, GoodsReturnQueryParseTest.class.getClassLoader());
                } catch (Throwable ignored) {
                    continue; // not loadable in isolation — never holds a @Query
                }
                if (annotation == null || type.isAnnotationPresent(annotation)) found.add(type);
            }
        }
        return found;
    }
}
