FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY distroiq-common/pom.xml distroiq-common/pom.xml
COPY distroiq-api/pom.xml distroiq-api/pom.xml
RUN mvn dependency:go-offline -q
COPY distroiq-common/src distroiq-common/src
COPY distroiq-api/src distroiq-api/src
RUN mvn clean package -DskipTests -q

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/distroiq-api/target/distroiq-api-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
