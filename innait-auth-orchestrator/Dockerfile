FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY ../pom.xml ./pom.xml
COPY ../innait-common ./innait-common
COPY innait-auth-orchestrator ./innait-auth-orchestrator
RUN mvn -pl innait-auth-orchestrator -am clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S wiam && adduser -S wiam -G wiam

COPY --from=build /app/innait-auth-orchestrator/target/*.jar app.jar

USER wiam

EXPOSE 8083

ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
