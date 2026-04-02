FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY ../pom.xml ./pom.xml
COPY ../innait-common ./innait-common
COPY innait-identity-service ./innait-identity-service
RUN mvn -pl innait-identity-service -am clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S wiam && adduser -S wiam -G wiam

COPY --from=build /app/innait-identity-service/target/*.jar app.jar

USER wiam

EXPOSE 8081

ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
