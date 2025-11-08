def call(Map config = [:]) {
    // Run tests; intended for use inside declarative pipeline steps
    if (config.testCommand) {
        sh config.testCommand
    } else {
        echo 'No testCommand provided, skipping tests.'
    }
}
