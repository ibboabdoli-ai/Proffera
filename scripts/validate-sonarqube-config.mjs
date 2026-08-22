function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const sonarToken = process.env.SONAR_TOKEN ?? "";
const projectKey = process.env.SONAR_PROJECT_KEY ?? "";
const hostUrl = process.env.SONAR_HOST_URL ?? "";
const organization = process.env.SONAR_ORGANIZATION ?? "";

if (!sonarToken) {
  fail("Refused: SONAR_TOKEN is required when SONARQUBE_ENABLED=true.");
}

if (!projectKey) {
  fail("Refused: SONAR_PROJECT_KEY is required when SONARQUBE_ENABLED=true.");
}

if (!hostUrl && !organization) {
  fail("Refused: configure SONAR_HOST_URL for SonarQube Server or SONAR_ORGANIZATION for SonarQube Cloud.");
}

if (hostUrl && organization) {
  fail("Refused: configure either SonarQube Server or SonarQube Cloud mode, not both.");
}
