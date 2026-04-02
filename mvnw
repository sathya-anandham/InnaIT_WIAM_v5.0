#!/bin/sh
# Maven Wrapper script for Unix/macOS/Linux/Git Bash
# Uses locally installed Maven at /c/Data/apache-maven-3.9.9 if present,
# otherwise falls back to downloading via the standard wrapper mechanism.

MAVEN_HOME="/c/Data/apache-maven-3.9.9"
if [ -f "$MAVEN_HOME/bin/mvn" ]; then
    exec "$MAVEN_HOME/bin/mvn" "$@"
fi

# Fallback: standard Maven Wrapper launcher
MAVEN_PROJECTBASEDIR="${MAVEN_BASEDIR:-$(dirname "$0")}"
exec "$MAVEN_PROJECTBASEDIR/.mvn/wrapper/MavenWrapperMain" \
    "--mvnw" "$0" "$@"
