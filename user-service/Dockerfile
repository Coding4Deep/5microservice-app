# Multi-stage build
FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml . 
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Use a valid OpenJDK image tag
FROM eclipse-temurin:17-jre-jammy

RUN groupadd -r appuser && useradd -r -g appuser appuser
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
RUN chown appuser:appuser app.jar
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
ENV SERVICE_NAME=user-service \
    CORS_ORIGINS=*
ENTRYPOINT ["sh", "-c",  "java -XX:+UseContainerSupport  $JAVA_OPTS -jar  app.jar"]
