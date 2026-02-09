#!/usr/bin/env node

/**
 * Simple test script to verify API endpoints
 * Usage: node test-api.js <base_url> [access_token]
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const ACCESS_TOKEN = process.argv[3];

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const lib = urlObj.protocol === 'https:' ? https : http;

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = lib.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

async function testEndpoint(name, url, options = {}) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   URL: ${url}`);

    try {
        const response = await request(url, options);
        console.log(`   ✅ Status: ${response.statusCode}`);

        if (response.body) {
            try {
                const json = JSON.parse(response.body);
                console.log(`   📦 Response:`, JSON.stringify(json, null, 2));
            } catch {
                console.log(`   📦 Response:`, response.body.substring(0, 200));
            }
        }

        return response;
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return null;
    }
}

async function runTests() {
    console.log('🚀 ForgeCV API Test Suite');
    console.log('='.repeat(50));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Auth Token: ${ACCESS_TOKEN ? '✅ Provided' : '❌ Not provided'}`);

    // Test 1: Google OAuth URL
    await testEndpoint(
        'GET /api/auth/google',
        `${BASE_URL}/api/auth/google`
    );

    // Test 2: Usage Status (requires auth)
    if (ACCESS_TOKEN) {
        await testEndpoint(
            'GET /api/usage/status',
            `${BASE_URL}/api/usage/status`,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                }
            }
        );

        // Test 3: AI Generation (requires auth)
        await testEndpoint(
            'POST /api/ai/generate',
            `${BASE_URL}/api/ai/generate`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: 'Say "Hello from ForgeCV API test!"',
                    taskType: 'default'
                })
            }
        );
    } else {
        console.log('\n⚠️  Skipping authenticated endpoints (no access token provided)');
        console.log('   To test authenticated endpoints, run:');
        console.log(`   node test-api.js ${BASE_URL} YOUR_ACCESS_TOKEN`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Test suite completed');
}

runTests().catch(console.error);
