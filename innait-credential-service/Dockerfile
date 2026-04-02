FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY ../pom.xml ./pom.xml
COPY ../innait-common ./innait-common
COPY innait-credential-service ./innait-credential-service
RUN mvn -pl innait-credential-service -am clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S wiam && adduser -S wiam -G wiam

COPY --from=build /app/innait-credential-service/target/*.jar app.jar

USER wiam

EXPOSE 8082

ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
