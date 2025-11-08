def call(Map config = [:]) {
    // A small generic notifier which can be extended. config.status, config.recipients etc.
    def status = config.status ?: currentBuild.currentResult
    if (config.slackChannel && config.slackTokenCredentialId) {
        // if Slack plugin present, user can adapt this to use slackSend
        echo "Would send Slack notification to ${config.slackChannel} with status ${status}"
    } else if (config.email) {
        // simple email step (requires Email-ext plugin configured)
        mail to: config.email, subject: "Build ${env.JOB_NAME} #${env.BUILD_NUMBER}: ${status}", body: "See ${env.BUILD_URL}"
    } else {
        echo "Build status: ${status}"
    }
}
