// Unverified example. 'docker-jdk25-node' must name an agent with JDK 25, the .nvmrc Node and Docker.
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
