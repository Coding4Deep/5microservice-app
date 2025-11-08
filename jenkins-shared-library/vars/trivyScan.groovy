def call(Map config = [:]) {
    // config.image OR config.dir
    def output = config.output ?: 'trivy-report.json'

    if (config.image) {
        echo "Running Trivy scan for image: ${config.image}"
        sh "trivy image --format json --output ${output} ${config.image}"
        if (config.failOnSeverity) {
            sh "trivy image --severity ${config.failOnSeverity} --exit-code 1 ${config.image} || true"
        }
        archiveArtifacts artifacts: output, fingerprint: true
    } else if (config.dir) {
        echo "Running Trivy filesystem scan for dir: ${config.dir}"
        sh "trivy fs --format json --output ${output} ${config.dir}"
        archiveArtifacts artifacts: output, fingerprint: true
    } else {
        echo 'trivyScan: no image or dir provided, skipping'
    }
}
