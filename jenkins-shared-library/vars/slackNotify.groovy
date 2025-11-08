def call(Map config = [:]) {
    // config.channel, config.message, config.color, config.status
    def status = config.status ?: currentBuild.currentResult
    def channel = config.channel ?: '#deployments'
    def color = config.color ?: (status == 'SUCCESS' ? 'good' : 'danger')
    def message = config.message ?: "Build: ${env.JOB_NAME} #${env.BUILD_NUMBER} - ${status}\n${env.BUILD_URL}"

    try {
        // Prefer slackSend if plugin available
        slackSend(channel: channel, color: color, message: message)
    } catch (err) {
        echo "slackSend unavailable or failed: ${err}"
        echo message
    }
}
