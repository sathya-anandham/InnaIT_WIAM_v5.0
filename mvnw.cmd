@REM Maven Wrapper script for Windows
@REM Uses locally installed Maven at C:\Data\apache-maven-3.9.9 if present.

@echo off
setlocal

set MAVEN_HOME=C:\Data\apache-maven-3.9.9
if exist "%MAVEN_HOME%\bin\mvn.cmd" (
    "%MAVEN_HOME%\bin\mvn.cmd" %*
    exit /b %ERRORLEVEL%
)

@REM Fallback: standard wrapper
set MAVEN_PROJECTBASEDIR=%~dp0
java -jar "%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar" %*
