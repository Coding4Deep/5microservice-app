def call(Map config = [:]) {
    // Intended to be called from declarative pipeline steps/script blocks.
    // Performs a checkout (using pipeline's `scm`) and optionally runs a build command.
    checkout scm

    if (config.buildCommand) {
        sh config.buildCommand
    } else {
        echo 'No buildCommand provided, skipping build step.'
    }
}
