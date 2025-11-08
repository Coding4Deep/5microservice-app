def call(Map config = [:]) {
    if (!config.image) {
        error 'publishDocker: image parameter is required'
    }

    if (config.registryUrl && config.credentialsId) {
        // Use docker.withRegistry when credentials are provided
        docker.withRegistry(config.registryUrl, config.credentialsId) {
            sh "docker push ${config.image}"
        }
    } else {
        // attempt plain push (requires pre-login on agent)
        sh "docker push ${config.image}"
    }
    echo "Published ${config.image}"
}
