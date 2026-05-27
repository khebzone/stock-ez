FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY stockez-common/pom.xml stockez-common/pom.xml
COPY stockez-api/pom.xml stockez-api/pom.xml
RUN mvn dependency:go-offline -q
COPY stockez-common/src stockez-common/src
COPY stockez-api/src stockez-api/src
RUN mvn clean package -DskipTests -q

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/stockez-api/target/stockez-api-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
