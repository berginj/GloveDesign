param location string = resourceGroup().location
param projectName string = 'glovedesign'
param wizardImage string = 'ghcr.io/your-org/glove-wizard:latest'

var storageName = toLower('${projectName}st')
var sbName = toLower('${projectName}sb')
var cosmosName = toLower('${projectName}cosmos')
var insightsName = toLower('${projectName}-appi')
var logName = toLower('${projectName}-log')
var planName = '${projectName}-plan'
var functionName = '${projectName}-func'
var containerEnvName = '${projectName}-env'
var wizardJobName = '${projectName}-wizard'
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

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

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  name: '${storage.name}/default/glovejobs'
  properties: {
    publicAccess: 'None'
  }
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

resource wizardQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  name: '${serviceBus.name}/wizardjobs'
  properties: {
    enablePartitioning: true
  }
}

resource wizardResultsQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  name: '${serviceBus.name}/wizardjobs-results'
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

resource plan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: planName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionName
  location: location
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'SERVICEBUS_CONNECTION__fullyQualifiedNamespace'
          value: '${serviceBus.name}.servicebus.windows.net'
        }
        {
          name: 'SERVICEBUS_NAMESPACE'
          value: '${serviceBus.name}.servicebus.windows.net'
        }
        {
          name: 'SERVICEBUS_QUEUE'
          value: 'glovejobs'
        }
        {
          name: 'WIZARD_QUEUE'
          value: 'wizardjobs'
        }
        {
          name: 'WIZARD_RESULTS_QUEUE'
          value: 'wizardjobs-results'
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmos.properties.documentEndpoint
        }
        {
          name: 'COSMOS_DATABASE'
          value: 'glovejobs'
        }
        {
          name: 'COSMOS_CONTAINER'
          value: 'jobs'
        }
        {
          name: 'BLOB_URL'
          value: 'https://${storage.name}.blob.core.windows.net'
        }
        {
          name: 'BLOB_CONTAINER'
          value: 'glovejobs'
        }
        {
          name: 'BLOB_BASE_URL'
          value: 'https://${storage.name}.blob.core.windows.net'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
  }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerEnvName
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
  name: wizardJobName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerEnv.id
    configuration: {
      triggerType: 'Manual'
    }
    template: {
      containers: [
        {
          name: 'wizard-worker'
          image: wizardImage
          resources: {
            cpu: 1
            memory: '2Gi'
          }
          env: [
            {
              name: 'SERVICEBUS_NAMESPACE'
              value: '${serviceBus.name}.servicebus.windows.net'
            }
            {
              name: 'WIZARD_QUEUE'
              value: 'wizardjobs'
            }
            {
              name: 'WIZARD_RESULTS_QUEUE'
              value: 'wizardjobs-results'
            }
            {
              name: 'BLOB_URL'
              value: 'https://${storage.name}.blob.core.windows.net'
            }
            {
              name: 'BLOB_CONTAINER'
              value: 'glovejobs'
            }
          ]
        }
      ]
    }
  }
}

resource storageBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionApp.identity.principalId, 'storage-blob')
  scope: storage
  properties: {
    principalId: functionApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  }
  dependsOn: [
    functionApp
  ]
}

resource storageBlobRoleWorker 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, containerJob.identity.principalId, 'storage-blob-worker')
  scope: storage
  properties: {
    principalId: containerJob.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  }
  dependsOn: [
    containerJob
  ]
}

resource serviceBusRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBus.id, functionApp.identity.principalId, 'servicebus-owner')
  scope: serviceBus
  properties: {
    principalId: functionApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '090c5cfd-751d-490a-894a-3ce6f1109419')
  }
  dependsOn: [
    functionApp
  ]
}

resource serviceBusRoleWorker 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBus.id, containerJob.identity.principalId, 'servicebus-owner-worker')
  scope: serviceBus
  properties: {
    principalId: containerJob.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '090c5cfd-751d-490a-894a-3ce6f1109419')
  }
  dependsOn: [
    containerJob
  ]
}

resource cosmosDataRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2022-11-15' = {
  name: guid(cosmos.id, functionApp.identity.principalId, 'cosmos-data')
  properties: {
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: functionApp.identity.principalId
    scope: cosmos.id
  }
  dependsOn: [
    functionApp
  ]
}

output storageAccountName string = storage.name
output serviceBusNamespace string = serviceBus.name
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output functionAppName string = functionApp.name
output wizardJobName string = containerJob.name
