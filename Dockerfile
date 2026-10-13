# One image for the whole site: the React app is built first and served by Spring Boot.

# 1. Web app
FROM node:26-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Backend, with the web app in its static resources
FROM eclipse-temurin:21-jdk AS api
WORKDIR /app
COPY backend/gradlew backend/settings.gradle backend/build.gradle ./
COPY backend/gradle ./gradle
RUN ./gradlew dependencies --no-daemon -q > /dev/null
COPY backend/src ./src
COPY --from=web /web/dist ./src/main/resources/static
RUN ./gradlew bootJar --no-daemon -q -x test && cp build/libs/*[!n].jar app.jar
# Split the jar into layers so dependency layers stay cached between releases
RUN java -Djarmode=tools -jar app.jar extract --layers --launcher --destination extracted

# 3. Runtime: JRE only (Alpine keeps the image small), non-root user
FROM eclipse-temurin:21-jre-alpine
RUN adduser -S -u 1001 app
WORKDIR /app
COPY --from=api /app/extracted/dependencies/ ./
COPY --from=api /app/extracted/spring-boot-loader/ ./
COPY --from=api /app/extracted/snapshot-dependencies/ ./
COPY --from=api /app/extracted/application/ ./
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "org.springframework.boot.loader.launch.JarLauncher"]
