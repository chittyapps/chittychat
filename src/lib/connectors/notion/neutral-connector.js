/**
 * Neutralized ChittyChain Notion Connector
 * Domain-agnostic data management for any use case
 */

import { Client } from '@notionhq/client';

export class NeutralNotionConnector {
  constructor(config) {
    this.notion = new Client({
      auth: config.NOTION_TOKEN
    });

    this.databases = {
      entities: config.NOTION_ENTITIES_DB,
      information: config.NOTION_INFORMATION_DB,
      facts: config.NOTION_FACTS_DB,
      connections: config.NOTION_CONNECTIONS_DB,
      evidence: config.NOTION_EVIDENCE_DB
    };

    this.entityTypes = ['PEO', 'PLACE', 'PROP', 'EVNT', 'AUTH'];
    this.informationTiers = ['PRIMARY_SOURCE', 'SECONDARY_SOURCE', 'TERTIARY_SOURCE', 'UNVERIFIED'];
    this.factClassifications = ['OBSERVATION', 'MEASUREMENT', 'STATEMENT', 'ANALYSIS', 'HYPOTHESIS'];
  }

  /**
   * Create a new entity in Notion
   */
  async createEntity(entityData) {
    const { type, name, description, metadata = {} } = entityData;

    if (!this.entityTypes.includes(type)) {
      throw new Error(`Invalid entity type. Must be one of: ${this.entityTypes.join(', ')}`);
    }

    try {
      const response = await this.notion.pages.create({
        parent: { database_id: this.databases.entities },
        properties: {
          'Name': {
            title: [{ text: { content: name } }]
          },
          'Type': {
            select: { name: type }
          },
          'Description': {
            rich_text: [{ text: { content: description || '' } }]
          },
          'Status': {
            select: { name: 'Active' }
          },
          'Created': {
            date: { start: new Date().toISOString() }
          },
          'Metadata': {
            rich_text: [{ text: { content: JSON.stringify(metadata) } }]
          }
        }
      });

      return {
        id: response.id,
        type,
        name,
        description,
        metadata,
        notionUrl: response.url,
        created: new Date()
      };
    } catch (error) {
      console.error('Error creating entity:', error);
      throw new Error(`Failed to create entity: ${error.message}`);
    }
  }

  /**
   * Create information record
   */
  async createInformation(informationData) {
    const { title, content, tier, source, entityId, metadata = {} } = informationData;

    if (!this.informationTiers.includes(tier)) {
      throw new Error(`Invalid information tier. Must be one of: ${this.informationTiers.join(', ')}`);
    }

    try {
      const response = await this.notion.pages.create({
        parent: { database_id: this.databases.information },
        properties: {
          'Title': {
            title: [{ text: { content: title } }]
          },
          'Tier': {
            select: { name: tier }
          },
          'Source': {
            rich_text: [{ text: { content: source || '' } }]
          },
          'Entity': {
            relation: entityId ? [{ id: entityId }] : []
          },
          'Created': {
            date: { start: new Date().toISOString() }
          },
          'Content': {
            rich_text: [{ text: { content: content } }]
          },
          'Metadata': {
            rich_text: [{ text: { content: JSON.stringify(metadata) } }]
          }
        }
      });

      return {
        id: response.id,
        title,
        content,
        tier,
        source,
        entityId,
        metadata,
        notionUrl: response.url,
        created: new Date()
      };
    } catch (error) {
      console.error('Error creating information:', error);
      throw new Error(`Failed to create information: ${error.message}`);
    }
  }

  /**
   * Create fact record
   */
  async createFact(factData) {
    const { statement, classification, confidence, source, entityIds = [], metadata = {} } = factData;

    if (!this.factClassifications.includes(classification)) {
      throw new Error(`Invalid fact classification. Must be one of: ${this.factClassifications.join(', ')}`);
    }

    try {
      const response = await this.notion.pages.create({
        parent: { database_id: this.databases.facts },
        properties: {
          'Statement': {
            title: [{ text: { content: statement } }]
          },
          'Classification': {
            select: { name: classification }
          },
          'Confidence': {
            number: confidence || 0.5
          },
          'Source': {
            rich_text: [{ text: { content: source || '' } }]
          },
          'Entities': {
            relation: entityIds.map(id => ({ id }))
          },
          'Created': {
            date: { start: new Date().toISOString() }
          },
          'Metadata': {
            rich_text: [{ text: { content: JSON.stringify(metadata) } }]
          }
        }
      });

      return {
        id: response.id,
        statement,
        classification,
        confidence,
        source,
        entityIds,
        metadata,
        notionUrl: response.url,
        created: new Date()
      };
    } catch (error) {
      console.error('Error creating fact:', error);
      throw new Error(`Failed to create fact: ${error.message}`);
    }
  }

  /**
   * Create connection between entities
   */
  async createConnection(connectionData) {
    const { fromEntityId, toEntityId, relationshipType, strength, description, metadata = {} } = connectionData;

    try {
      const response = await this.notion.pages.create({
        parent: { database_id: this.databases.connections },
        properties: {
          'From Entity': {
            relation: [{ id: fromEntityId }]
          },
          'To Entity': {
            relation: [{ id: toEntityId }]
          },
          'Relationship Type': {
            rich_text: [{ text: { content: relationshipType } }]
          },
          'Strength': {
            number: strength || 0.5
          },
          'Description': {
            rich_text: [{ text: { content: description || '' } }]
          },
          'Created': {
            date: { start: new Date().toISOString() }
          },
          'Metadata': {
            rich_text: [{ text: { content: JSON.stringify(metadata) } }]
          }
        }
      });

      return {
        id: response.id,
        fromEntityId,
        toEntityId,
        relationshipType,
        strength,
        description,
        metadata,
        notionUrl: response.url,
        created: new Date()
      };
    } catch (error) {
      console.error('Error creating connection:', error);
      throw new Error(`Failed to create connection: ${error.message}`);
    }
  }

  /**
   * Read entities from Notion
   */
  async getEntities(filters = {}) {
    try {
      const queryOptions = {
        database_id: this.databases.entities,
        sorts: [
          {
            property: 'Created',
            direction: 'descending'
          }
        ]
      };

      if (filters.type) {
        queryOptions.filter = {
          property: 'Type',
          select: { equals: filters.type }
        };
      }

      const response = await this.notion.databases.query(queryOptions);

      return response.results.map(page => ({
        id: page.id,
        name: page.properties.Name?.title?.[0]?.text?.content || '',
        type: page.properties.Type?.select?.name || '',
        description: page.properties.Description?.rich_text?.[0]?.text?.content || '',
        status: page.properties.Status?.select?.name || '',
        created: page.properties.Created?.date?.start || '',
        metadata: this.parseMetadata(page.properties.Metadata?.rich_text?.[0]?.text?.content),
        notionUrl: page.url
      }));
    } catch (error) {
      console.error('Error getting entities:', error);
      throw new Error(`Failed to get entities: ${error.message}`);
    }
  }

  /**
   * Read information from Notion
   */
  async getInformation(filters = {}) {
    try {
      const queryOptions = {
        database_id: this.databases.information,
        sorts: [
          {
            property: 'Created',
            direction: 'descending'
          }
        ]
      };

      if (filters.tier) {
        queryOptions.filter = {
          property: 'Tier',
          select: { equals: filters.tier }
        };
      }

      const response = await this.notion.databases.query(queryOptions);

      return response.results.map(page => ({
        id: page.id,
        title: page.properties.Title?.title?.[0]?.text?.content || '',
        content: page.properties.Content?.rich_text?.[0]?.text?.content || '',
        tier: page.properties.Tier?.select?.name || '',
        source: page.properties.Source?.rich_text?.[0]?.text?.content || '',
        entityId: page.properties.Entity?.relation?.[0]?.id || null,
        created: page.properties.Created?.date?.start || '',
        metadata: this.parseMetadata(page.properties.Metadata?.rich_text?.[0]?.text?.content),
        notionUrl: page.url
      }));
    } catch (error) {
      console.error('Error getting information:', error);
      throw new Error(`Failed to get information: ${error.message}`);
    }
  }

  /**
   * Read facts from Notion
   */
  async getFacts(filters = {}) {
    try {
      const queryOptions = {
        database_id: this.databases.facts,
        sorts: [
          {
            property: 'Created',
            direction: 'descending'
          }
        ]
      };

      if (filters.classification) {
        queryOptions.filter = {
          property: 'Classification',
          select: { equals: filters.classification }
        };
      }

      const response = await this.notion.databases.query(queryOptions);

      return response.results.map(page => ({
        id: page.id,
        statement: page.properties.Statement?.title?.[0]?.text?.content || '',
        classification: page.properties.Classification?.select?.name || '',
        confidence: page.properties.Confidence?.number || 0,
        source: page.properties.Source?.rich_text?.[0]?.text?.content || '',
        entityIds: page.properties.Entities?.relation?.map(rel => rel.id) || [],
        created: page.properties.Created?.date?.start || '',
        metadata: this.parseMetadata(page.properties.Metadata?.rich_text?.[0]?.text?.content),
        notionUrl: page.url
      }));
    } catch (error) {
      console.error('Error getting facts:', error);
      throw new Error(`Failed to get facts: ${error.message}`);
    }
  }

  /**
   * Read connections from Notion
   */
  async getConnections(filters = {}) {
    try {
      const queryOptions = {
        database_id: this.databases.connections,
        sorts: [
          {
            property: 'Created',
            direction: 'descending'
          }
        ]
      };

      const response = await this.notion.databases.query(queryOptions);

      return response.results.map(page => ({
        id: page.id,
        fromEntityId: page.properties['From Entity']?.relation?.[0]?.id || null,
        toEntityId: page.properties['To Entity']?.relation?.[0]?.id || null,
        relationshipType: page.properties['Relationship Type']?.rich_text?.[0]?.text?.content || '',
        strength: page.properties.Strength?.number || 0,
        description: page.properties.Description?.rich_text?.[0]?.text?.content || '',
        created: page.properties.Created?.date?.start || '',
        metadata: this.parseMetadata(page.properties.Metadata?.rich_text?.[0]?.text?.content),
        notionUrl: page.url
      }));
    } catch (error) {
      console.error('Error getting connections:', error);
      throw new Error(`Failed to get connections: ${error.message}`);
    }
  }

  /**
   * Update entity in Notion
   */
  async updateEntity(entityId, updates) {
    try {
      const properties = {};

      if (updates.name) {
        properties.Name = {
          title: [{ text: { content: updates.name } }]
        };
      }

      if (updates.description) {
        properties.Description = {
          rich_text: [{ text: { content: updates.description } }]
        };
      }

      if (updates.status) {
        properties.Status = {
          select: { name: updates.status }
        };
      }

      if (updates.metadata) {
        properties.Metadata = {
          rich_text: [{ text: { content: JSON.stringify(updates.metadata) } }]
        };
      }

      const response = await this.notion.pages.update({
        page_id: entityId,
        properties
      });

      return {
        id: response.id,
        updated: new Date(),
        notionUrl: response.url
      };
    } catch (error) {
      console.error('Error updating entity:', error);
      throw new Error(`Failed to update entity: ${error.message}`);
    }
  }

  /**
   * Search across all databases
   */
  async search(query, databases = ['entities', 'information', 'facts']) {
    const results = {
      entities: [],
      information: [],
      facts: []
    };

    try {
      for (const dbType of databases) {
        if (!this.databases[dbType]) continue;

        const response = await this.notion.search({
          query,
          filter: {
            property: 'object',
            value: 'page'
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time'
          }
        });

        // Filter results by database
        const dbResults = response.results.filter(page =>
          page.parent?.database_id === this.databases[dbType]
        );

        results[dbType] = dbResults.map(page => ({
          id: page.id,
          url: page.url,
          lastEdited: page.last_edited_time,
          properties: page.properties
        }));
      }

      return results;
    } catch (error) {
      console.error('Error searching:', error);
      throw new Error(`Failed to search: ${error.message}`);
    }
  }

  /**
   * Get connection health and statistics
   */
  async getHealth() {
    try {
      const [entities, information, facts, connections] = await Promise.all([
        this.getEntities(),
        this.getInformation(),
        this.getFacts(),
        this.getConnections()
      ]);

      return {
        connected: true,
        databases: {
          entities: { count: entities.length, id: this.databases.entities },
          information: { count: information.length, id: this.databases.information },
          facts: { count: facts.length, id: this.databases.facts },
          connections: { count: connections.length, id: this.databases.connections }
        },
        lastChecked: new Date(),
        status: 'healthy'
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        lastChecked: new Date(),
        status: 'error'
      };
    }
  }

  /**
   * Helper: Parse metadata JSON
   */
  parseMetadata(metadataString) {
    try {
      return metadataString ? JSON.parse(metadataString) : {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Validate database configuration
   */
  async validateDatabases() {
    const validation = {
      valid: true,
      databases: {},
      errors: []
    };

    for (const [name, databaseId] of Object.entries(this.databases)) {
      try {
        const response = await this.notion.databases.retrieve({
          database_id: databaseId
        });

        validation.databases[name] = {
          id: databaseId,
          title: response.title?.[0]?.plain_text || name,
          valid: true
        };
      } catch (error) {
        validation.valid = false;
        validation.databases[name] = {
          id: databaseId,
          valid: false,
          error: error.message
        };
        validation.errors.push(`${name}: ${error.message}`);
      }
    }

    return validation;
  }
}

export default NeutralNotionConnector;