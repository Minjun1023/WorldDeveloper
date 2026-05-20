# --- build stage ---
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY gradlew settings.gradle build.gradle gradle.properties ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon || true
COPY src ./src
RUN ./gradlew bootJar --no-daemon

# --- run stage ---
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
# Railway 는 PORT env 를 주입 — application.yml 의 ${PORT:8080} 가 사용
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
