def call(Map config = [:]) {
    def manifest = config.k8sManifest ?: 'k8s/'
    if (config.kubeconfigFile) {
        // if provided, write kubeconfig to workspace and use it
        writeFile file: 'kubeconfig', text: config.kubeconfigFile
        withEnv(["KUBECONFIG=${pwd()}/kubeconfig"]) {
            sh "kubectl apply -f ${manifest}"
        }
    } else {
        sh "kubectl apply -f ${manifest}"
    }
    echo "Applied k8s manifest: ${manifest}"
}
