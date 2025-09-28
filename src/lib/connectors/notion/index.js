/**
 * Neutralized ChittyChain Notion Connector - Main Export
 * Domain-agnostic data management framework
 */

export { NeutralNotionConnector } from './neutral-connector.js';

// Export types and utilities
export const ENTITY_TYPES = ['PEO', 'PLACE', 'PROP', 'EVNT', 'AUTH'];
export const INFORMATION_TIERS = ['PRIMARY_SOURCE', 'SECONDARY_SOURCE', 'TERTIARY_SOURCE', 'UNVERIFIED'];
export const FACT_CLASSIFICATIONS = ['OBSERVATION', 'MEASUREMENT', 'STATEMENT', 'ANALYSIS', 'HYPOTHESIS'];

// Default configuration
export const DEFAULT_CONFIG = {
  entityTypes: ENTITY_TYPES,
  informationTiers: INFORMATION_TIERS,
  factClassifications: FACT_CLASSIFICATIONS,
  defaultTier: 'UNVERIFIED',
  defaultClassification: 'OBSERVATION',
  defaultConfidence: 0.5
};

// Create connector instance
export function createNotionConnector(config) {
  return new NeutralNotionConnector(config);
}

export default {
  NeutralNotionConnector,
  createNotionConnector,
  ENTITY_TYPES,
  INFORMATION_TIERS,
  FACT_CLASSIFICATIONS,
  DEFAULT_CONFIG
};