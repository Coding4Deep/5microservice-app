Templates for service Jenkinsfiles
================================

This folder contains per-service Jenkinsfile templates derived from the original pipelines in this repo. Use these templates as a starting point when creating or restoring service Jenkinsfiles.

Files:
- `chat-service.Jenkinsfile.template` - original chat-service pipeline (Node.js)
- `frontend.Jenkinsfile.template` - original frontend pipeline (Node.js + S3)
- `posts-service.Jenkinsfile.template` - original posts-service pipeline (Go)
- `profile-service.Jenkinsfile.template` - original profile-service pipeline (Python)
- `user-service.Jenkinsfile.template` - original user-service pipeline (Java/Maven)

How to use:
 - Copy the relevant template into the service directory as `Jenkinsfile`.
 - Adjust environment variables, credentials IDs, and infrastructure details (k8s namespaces, registry, etc.) as needed.

Note: These templates are intentionally full-featured and mirror the original CI pipelines used in the project. You can also choose to adopt the shared library steps in `../` to centralize repetitive logic.
