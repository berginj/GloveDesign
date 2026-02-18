import { createCatalogEndpoint } from "../factory";

// Use generic factory to eliminate boilerplate
createCatalogEndpoint("materials", "getCatalogMaterials", "catalog/materials");
