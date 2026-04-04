FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S wiam && adduser -S wiam -G wiam
COPY innait-token-service/target/innait-token-service-5.0.0-SNAPSHOT.jar app.jar
USER wiam
EXPOSE 8086
ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
