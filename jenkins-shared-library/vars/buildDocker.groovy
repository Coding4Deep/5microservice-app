def call(Map config = [:]) {
    // Build docker image from given directory and tag
    def image = config.image ?: "${env.JOB_NAME ?: 'app'}:latest"
    def dir = config.dockerfileDir ?: '.'
    sh "docker build -t ${image} ${dir}"
    echo "Built ${image}"
}
