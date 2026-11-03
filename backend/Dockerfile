FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace

COPY backend/.mvn backend/.mvn
COPY backend/mvnw backend/pom.xml backend/
COPY backend/src backend/src

# Tests are not run here: the CI `docker` job only builds this image after the
# `backend` job (./mvnw verify) has already passed for this exact commit.
RUN cd backend && ./mvnw -DskipTests package

FROM eclipse-temurin:21-jre-ubi10-minimal

RUN microdnf install -y --setopt=install_weak_deps=0 python3 python3-pip curl-minimal \
    && microdnf clean all

WORKDIR /app

COPY python python
COPY analysis_output analysis_output

# Keep the runtime contract explicit: Spring launches these files through
# ProcessBuilder, so a healthy JVM alone is not sufficient.
RUN python3 -m venv /app/venv \
    && /app/venv/bin/pip install --no-cache-dir -r python/requirements.txt \
    && /app/venv/bin/python3 -c "import mido" \
    && test -f /app/analysis_output/midi_analysis.json \
    && test -f /app/python/generate_midi.py \
    && test -f /app/python/temp_analyzer.py \
    && mkdir -p /app/generated_midi /app/temp_analysis /app/user_uploads \
    && chown -R 10001:0 /app

COPY --from=build --chown=10001:0 /workspace/backend/target/*.jar /app/backend.jar

ENV SERVER_PORT=8081
ENV ICEPUNK_GENERATOR_PROJECT_DIR=/app
ENV ICEPUNK_GENERATOR_PYTHON_PATH=/app/venv/bin/python3
ENV ICEPUNK_GENERATOR_SCRIPT_NAME=python/generate_midi.py
ENV ICEPUNK_TEMP_ANALYZER_SCRIPT_NAME=python/temp_analyzer.py
ENV JAVA_OPTS=""

EXPOSE 8081

USER 10001

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/backend.jar"]
