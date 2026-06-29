FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace

COPY backend/.mvn backend/.mvn
COPY backend/mvnw backend/pom.xml backend/
COPY backend/src backend/src

RUN cd backend && ./mvnw -DskipTests package

FROM eclipse-temurin:21-jre

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt icepunk_midi_generator.py ./
COPY analysis_output analysis_output

RUN python3 -m venv /app/venv \
    && /app/venv/bin/pip install --no-cache-dir -r requirements.txt \
    && mkdir -p /app/generated_midi \
    && groupadd --system icepunk \
    && useradd --system --gid icepunk --home-dir /app icepunk \
    && chown -R icepunk:icepunk /app

COPY --from=build /workspace/backend/target/*.jar /app/backend.jar

RUN chown icepunk:icepunk /app/backend.jar

ENV SERVER_PORT=8081
ENV ICEPUNK_GENERATOR_PROJECT_DIR=/app
ENV ICEPUNK_GENERATOR_PYTHON_PATH=/app/venv/bin/python3
ENV ICEPUNK_GENERATOR_SCRIPT_NAME=icepunk_midi_generator.py
ENV JAVA_OPTS=""

EXPOSE 8081

USER icepunk

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/backend.jar"]
