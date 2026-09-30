FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM eclipse-temurin:17-jdk AS backend
WORKDIR /app
COPY backend ./backend
COPY --from=frontend /app/dist ./dist
WORKDIR /app/backend
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=backend /app/backend/build/libs/magam-beauty.jar ./app.jar
ENV SPRING_PROFILES_ACTIVE=prod
EXPOSE 8080
USER 10001
ENTRYPOINT ["java", "-Djava.awt.headless=true", "-jar", "app.jar"]
