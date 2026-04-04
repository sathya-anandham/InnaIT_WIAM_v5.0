FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S wiam && adduser -S wiam -G wiam
COPY innait-admin-config-service/target/innait-admin-config-service-5.0.0-SNAPSHOT.jar app.jar
USER wiam
EXPOSE 8090
ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
