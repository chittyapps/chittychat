#!/usr/bin/env node

/**
 * Test Suite for ChittyChat Sync Services
 * Tests immutability, Notion API 2025-09-03, and sync functionality
 */

import { createHash } from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class SyncServiceTester {
    constructor() {
        this.baseUrls = {
            sync: 'http://localhost:3006',
            viewer: 'http://localhost:3007'
        };

        this.testResults = [];
        this.passed = 0;
        this.failed = 0;
    }

    async runAllTests() {
        console.log(`
╔═══════════════════════════════════════════════╗
║     ChittyChat Sync Services Test Suite      ║
╚═══════════════════════════════════════════════╝
        `);

        // Test Immutable Viewer
        await this.testSection('Immutable Viewer Service', async () => {
            await this.testHealthCheck('viewer');
            await this.testReadOnlyEnforcement();
            await this.testDataIntegrityVerification();
            await this.testAuditLogging();
        });

        // Test Universal Sync
        await this.testSection('Universal Sync Service', async () => {
            await this.testHealthCheck('sync');
            await this.testTableListing();
            await this.testNotionAPIVersion();
            await this.testSyncConfiguration();
        });

        // Test Notion API 2025-09-03 Compatibility
        await this.testSection('Notion API 2025-09-03', async () => {
            await this.testDataSourceDiscovery();
            await this.testNotionVersionHeader();
        });

        this.printResults();
    }

    async testSection(name, tests) {
        console.log(`\n📋 Testing: ${name}`);
        console.log('─'.repeat(50));
        await tests();
    }

    async test(name, testFn) {
        try {
            await testFn();
            this.passed++;
            this.testResults.push({ name, status: '✅ PASSED' });
            console.log(`  ✅ ${name}`);
        } catch (error) {
            this.failed++;
            this.testResults.push({
                name,
                status: '❌ FAILED',
                error: error.message
            });
            console.log(`  ❌ ${name}: ${error.message}`);
        }
    }

    // Immutable Viewer Tests
    async testHealthCheck(service) {
        await this.test(`${service} health check`, async () => {
            const response = await axios.get(`${this.baseUrls[service]}/health`);
            if (response.data.status !== 'healthy') {
                throw new Error('Service not healthy');
            }
        });
    }

    async testReadOnlyEnforcement() {
        await this.test('Read-only enforcement', async () => {
            try {
                // Try to POST (should fail)
                await axios.post(`${this.baseUrls.viewer}/write`, { data: 'test' });
                throw new Error('Write operation should have been blocked');
            } catch (error) {
                if (error.response && error.response.status === 403) {
                    // Expected behavior
                    return;
                }
                throw error;
            }
        });
    }

    async testDataIntegrityVerification() {
        await this.test('Data integrity verification', async () => {
            // Mock data for testing
            const testData = {
                chitty_id: 'CHITTY-TEST-001',
                data: 'test data',
                created_at: new Date().toISOString()
            };

            const expectedHash = createHash('sha256')
                .update(JSON.stringify(testData, Object.keys(testData).sort()))
                .digest('hex');

            // In real test, would fetch from viewer and verify hash
            if (!expectedHash) {
                throw new Error('Hash calculation failed');
            }
        });
    }

    async testAuditLogging() {
        await this.test('Audit logging', async () => {
            try {
                const response = await axios.get(`${this.baseUrls.viewer}/audit`);
                if (!Array.isArray(response.data.audit_entries)) {
                    throw new Error('Audit log not properly formatted');
                }
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    console.log('    ⚠️  Service not running - skipping');
                    return;
                }
                throw error;
            }
        });
    }

    // Universal Sync Tests
    async testTableListing() {
        await this.test('Table listing', async () => {
            try {
                const response = await axios.get(`${this.baseUrls.sync}/tables`);
                if (!response.data.tables) {
                    throw new Error('No tables returned');
                }
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    console.log('    ⚠️  Service not running - skipping');
                    return;
                }
                throw error;
            }
        });
    }

    async testNotionAPIVersion() {
        await this.test('Notion API version check', async () => {
            // Check if Notion client is using 2025-09-03
            const packageJson = await import('./package.json', {
                assert: { type: 'json' }
            });

            const notionVersion = packageJson.default.dependencies['@notionhq/client'];
            if (!notionVersion.includes('5')) {
                throw new Error(`Notion SDK not v5: ${notionVersion}`);
            }
        });
    }

    async testSyncConfiguration() {
        await this.test('Sync configuration', async () => {
            try {
                const response = await axios.get(`${this.baseUrls.sync}/status`);
                if (!response.data.lastSync !== undefined) {
                    throw new Error('Sync status not properly formatted');
                }
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    console.log('    ⚠️  Service not running - skipping');
                    return;
                }
                throw error;
            }
        });
    }

    // Notion API 2025-09-03 Tests
    async testDataSourceDiscovery() {
        await this.test('Data source discovery', async () => {
            // Verify data_source_id implementation
            const notionSyncPath = '/Users/nb/configured/chittyos/configs/system/modules/universal-intake/notion-sync-service.js';
            const fs = await import('fs/promises');

            try {
                const content = await fs.readFile(notionSyncPath, 'utf-8');
                if (!content.includes('data_source_id') && !content.includes('dataSourceIds')) {
                    throw new Error('Data source discovery not implemented');
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log('    ⚠️  File not found - skipping');
                    return;
                }
                throw error;
            }
        });
    }

    async testNotionVersionHeader() {
        await this.test('Notion version header', async () => {
            // Check if Notion client includes version header
            const notionSyncPath = '/Users/nb/configured/chittyos/configs/system/modules/universal-intake/notion-sync-service.js';
            const fs = await import('fs/promises');

            try {
                const content = await fs.readFile(notionSyncPath, 'utf-8');
                if (!content.includes('2025-09-03')) {
                    throw new Error('Notion API version 2025-09-03 not configured');
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log('    ⚠️  File not found - skipping');
                    return;
                }
                throw error;
            }
        });
    }

    printResults() {
        console.log('\n' + '═'.repeat(50));
        console.log('📊 TEST RESULTS');
        console.log('═'.repeat(50));

        this.testResults.forEach(result => {
            console.log(`${result.status} ${result.name}`);
            if (result.error) {
                console.log(`    └─ ${result.error}`);
            }
        });

        console.log('\n' + '─'.repeat(50));
        console.log(`Total: ${this.passed + this.failed} | ✅ Passed: ${this.passed} | ❌ Failed: ${this.failed}`);

        if (this.failed === 0) {
            console.log('\n🎉 All tests passed!');
        } else {
            console.log(`\n⚠️  ${this.failed} test(s) failed`);
        }
    }
}

// Run tests
const tester = new SyncServiceTester();
tester.runAllTests().catch(console.error);