// Unverified example: not run against a real Jenkins instance.
// Agent label: 'docker-jdk25-node' must name an agent with JDK 25, the Node version in .nvmrc and a Docker
// daemon (Testcontainers and the image smoke test need it). Rename the label to match yours.
pipeline {
  agent { label 'docker-jdk25-node' }
  stages {
    stage('verify') {
      steps {
        sh 'node scripts/verify.mjs'
      }
    }
  }
}
