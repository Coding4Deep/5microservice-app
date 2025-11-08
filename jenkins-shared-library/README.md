Jenkins Shared Library for web-chat
=================================

This directory contains a minimal Jenkins Pipeline Shared Library scaffold intended to centralize common pipeline logic used by the microservices inside `web-chat` (chat-service, frontend, posts-service, profile-service, user-service).

Structure
---------
- vars/ - lightweight global steps callable directly from Jenkinsfiles (e.g. `checkoutAndBuild`, `runTests`, `buildDocker`, `publishDocker`, `k8sDeploy`, `notify`).
- src/com/webchat/common/ - utility classes (e.g. `Utils.groovy`).

How to register the library in Jenkins
-------------------------------------
1. In Jenkins go to "Manage Jenkins" -> "Configure System" -> "Global Pipeline Libraries".
2. Add a new library with:
   - Name: `webChatShared` (pick a name you'll reference from Jenkinsfiles)
   - Default version: `master` or any branch/tag you prefer
   - Retrieval method: Modern SCM -> Git
   - Project repository: point to this repository (e.g. the git URL of the web-chat repo)
   - Credentials: as needed for repo access

Using the library from a Jenkinsfile
-----------------------------------
Add the top of your Jenkinsfile:

    @Library('webChatShared@master') _

Then call the steps like:

    pipeline {
      agent any
      stages {
        stage('Build & Test') {
          steps {
            script {
              checkoutAndBuild(buildCommand: 'npm ci && npm run build')
              runTests(testCommand: 'npm test')
            }
          }
        }
        stage('Docker') {
          steps {
            script {
              buildDocker(image: "myregistry/myapp:${env.BUILD_NUMBER}")
              publishDocker(image: "myregistry/myapp:${env.BUILD_NUMBER}", registryUrl: 'https://registry.hub.docker.com', credentialsId: 'dockerhub-creds')
            }
          }
        }
      }
      post {
        always {
          script { notify(status: currentBuild.currentResult, email: 'team@example.com') }
        }
      }
    }

Notes and next steps
--------------------
- The provided steps are intentionally small and safe. Adapt the `sh` commands to the build tools your services use (Gradle/Maven/Go/Npm).
- You can add more environment-specific helpers (e.g. credentials handling, advanced Kubernetes deployment logic) in `src/`.
- If you want, I can also update each service's Jenkinsfile to use the shared library and standardize the pipeline. Say the word and I will patch the service Jenkinsfiles.
