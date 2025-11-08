def call(Map config = [:]) {
    // config.projectKey (required), config.scannerCommand (optional), config.sonarEnv (optional Jenkins Sonar env name)
    if (!config.projectKey) {
        echo 'sonarScan: projectKey not provided, skipping Sonar scan.'
        return
    }

    def cmd = config.scannerCommand ?: "sonar-scanner -Dsonar.projectKey=${config.projectKey}"

    if (config.sonarEnv) {
        // Use configured SonarQube server credentials/environment
        withSonarQubeEnv(config.sonarEnv) {
            sh cmd
        }
    } else {
        sh cmd
    }

    echo "Triggered Sonar scan for project ${config.projectKey}"
}
