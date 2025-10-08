# Scripts Directory Organization

This directory contains all scripts for the RAG MongoDB project, organized into logical subfolders.

## 📁 Folder Structure

### `/embeddings` - Embedding Generation Scripts
Scripts for creating and managing embeddings using OpenAI and Testleaf APIs.

- **`create-embeddings-openai-direct.js`** - ⭐ **RECOMMENDED** - Fast batch embedding generation using OpenAI API directly (3-5 min for 6K testcases)
- **`create-embeddings-batch.js`** - Batch embedding generation using Testleaf API (10-15 min for 6K testcases)
- **`create-userstories-embeddings-batch.js`** - Batch process user stories embeddings
- **`create-embeddings-store.js`** - Original sequential embedding generation (slower, legacy)
- **`create-jira-embeddings-store.js`** - Generate embeddings for Jira stories
- **`create-userstories-embeddings-store.js`** - Generate embeddings for user stories (sequential)
- **`create-openai-batch.js`** - Create OpenAI batch job for embeddings
- **`check-batch-status.js`** - Monitor OpenAI batch job status
- **`download-batch-results.js`** - Download completed batch results
- **`test-embeddings-batch.js`** - Test batch embedding functionality

### `/search` - Vector Search Scripts
Scripts for querying and searching the vector database.

- **`search-vector-db.js`** - Search test cases using vector similarity
- **`search-jira-stories.js`** - Search Jira stories in vector database
- **`search-combined-stores.js`** - Search across multiple collections simultaneously

### `/data-conversion` - Data Transformation Scripts
Scripts for converting data from various sources into usable formats.

- **`excel-to-userstories.js`** - Convert Excel user stories to JSON format
- **`excel-to-json.js`** - General Excel to JSON converter for testcases
- **`fetch-jira-stories.js`** - Fetch user stories from Jira API

### `/verification` - Data Quality & Validation Scripts
Scripts for verifying data integrity and quality.

- **`verify-embedding-uniqueness.js`** - Check embeddings are unique (detects duplicate embedding issues)

### `/migration` - Database Migration Scripts
Scripts for migrating and updating existing data structures.

- **`migrate-linked-stories-to-array.js`** - Convert linkedStories from comma-separated strings to arrays

### `/utilities` - Utility Scripts
General purpose utility scripts.

- **`delete-all-documents.js`** - Delete all documents from a collection (use with caution!)

## 🚀 Quick Start Guide

### Generate Embeddings (Recommended)
```bash
# For testcases - Fast OpenAI direct method
node src/scripts/embeddings/create-embeddings-openai-direct.js

# For user stories
node src/scripts/embeddings/create-userstories-embeddings-batch.js
```

### Search Vector Database
```bash
# Search testcases
node src/scripts/search/search-vector-db.js

# Search user stories
node src/scripts/search/search-jira-stories.js
```

### Data Conversion
```bash
# Convert Excel to JSON
node src/scripts/data-conversion/excel-to-userstories.js
```

### Verify Data Quality
```bash
# Check embedding uniqueness
node src/scripts/verification/verify-embedding-uniqueness.js
```

### Migrate Data
```bash
# Fix linkedStories format
node src/scripts/migration/migrate-linked-stories-to-array.js
```

## 📊 Performance Comparison

| Script | Method | Time (6K testcases) | Speed |
|--------|--------|---------------------|-------|
| `create-embeddings-openai-direct.js` | OpenAI Direct | 3-5 min | ⚡ Fastest |
| `create-embeddings-batch.js` | Testleaf API | 10-15 min | 🚀 Fast |
| `create-embeddings-store.js` | Sequential | 50-60 min | 🐌 Slow |

## 🔧 Configuration

All scripts use environment variables from `.env`:
- `MONGODB_URI` - MongoDB Atlas connection string
- `OPENAI_API_KEY` - OpenAI API key for direct embeddings
- `TESTLEAF_API_KEY` - Testleaf API key (alternative)
- `DB_NAME` - Database name (default: QEagle_AI_RAC_DB)
- `COLLECTION_NAME` - Collection name (default: test_cases)

## 📝 Notes

- Always run verification scripts after generating embeddings
- Use migration scripts when data structure changes are needed
- Search scripts require vector indexes to be created in MongoDB Atlas
- Backup data before running utility scripts like `delete-all-documents.js`
