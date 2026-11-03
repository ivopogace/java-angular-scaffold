# The production image (docs/adr/0006-production-image-from-dockerfile.md).

# The Node version of .nvmrc; smoke-image.mjs refuses to build when the two differ.
FROM node:26.13.0-trixie-slim AS frontend
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# The JDK of the Gradle toolchain; smoke-image.mjs checks the two agree.
FROM eclipse-temurin:25.0.5_8-jdk-noble AS backend
WORKDIR /workspace/backend
COPY backend/ ./
# checkSpaPackaged reads the locales from angular.json.
COPY frontend/angular.json /workspace/frontend/angular.json
COPY --from=frontend /workspace/frontend/dist /workspace/frontend/dist
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon :bootstrap:checkSpaPackaged :bootstrap:bootJar \
 && find bootstrap/build/libs -name '*.jar' ! -name '*-plain.jar' -exec cp {} /workspace/application.jar \;
WORKDIR /workspace
# Dependencies change less often than the application, so they land in earlier, cacheable layers.
RUN java -Djarmode=tools -jar application.jar extract --layers --destination extracted

FROM eclipse-temurin:25.0.5_8-jre-noble
RUN groupadd --gid 10001 app \
 && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app
WORKDIR /application
COPY --from=backend /workspace/extracted/dependencies/ ./
COPY --from=backend /workspace/extracted/spring-boot-loader/ ./
COPY --from=backend /workspace/extracted/snapshot-dependencies/ ./
COPY --from=backend /workspace/extracted/application/ ./
USER 10001:10001
# The JVM's default heap is a quarter of the container's memory.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "application.jar"]
