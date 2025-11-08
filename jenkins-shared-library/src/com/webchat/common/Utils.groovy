package com.webchat.common

class Utils implements Serializable {
    def script
    Utils(def script) { this.script = script }

    def safeShell(String cmd) {
        // helper to run shell but show command first
        script.echo "Running: ${cmd}"
        script.sh cmd
    }

    static String normalizeImageName(String name) {
        return name.replaceAll('[^A-Za-z0-9_\-\./:]', '-')
    }
}
