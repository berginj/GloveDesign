import { createCatalogEndpoint } from "../factory";

// Use generic factory to eliminate boilerplate
createCatalogEndpoint("brands", "getCatalogBrands", "catalog/brands");
