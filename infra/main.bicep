param location string = resourceGroup().location
param projectName string = 'glovedesign'

var storageName = toLower('${projectName}storage')
var sbName = toLower('${projectName}sb')
var cosmosName = toLower('${projectName}cosmos')
var insightsName = toLower('${projectName}-appi')
var logName = toLower('${projectName}-log')
var keyVaultName = toLower('${projectName}-kv')

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

resource serviceBus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: sbName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
}

resource queue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  name: '${serviceBus.name}/glovejobs'
  properties: {
    enablePartitioning: true
  }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2022-11-15' = {
  name: cosmosName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
      }
    ]
    enableFreeTier: true
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2022-11-15' = {
  name: '${cosmos.name}/glovejobs'
  properties: {
    resource: {
      id: 'glovejobs'
    }
  }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2022-11-15' = {
  name: '${cosmos.name}/glovejobs/jobs'
  properties: {
    resource: {
      id: 'jobs'
      partitionKey: {
        paths: [
          '/jobId'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: []
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: true
  }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${projectName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource containerJob 'Microsoft.App/jobs@2023-05-01' = {
  name: '${projectName}-wizard'
  location: location
  properties: {
    environmentId: containerEnv.id
    configuration: {
      triggerType: 'Manual'
    }
    template: {
      containers: [
        {
          name: 'wizard-worker'
          image: 'ghcr.io/your-org/glove-wizard:latest'
          resources: {
            cpu: 1
            memory: '2Gi'
          }
        }
      ]
    }
  }
}

output storageAccountName string = storage.name
output serviceBusNamespace string = serviceBus.name
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output appInsightsName string = appInsights.name
