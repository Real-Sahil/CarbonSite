const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkStorageKeys() {
  try {
    // Check for corrupted storageKey values
    const corrupted = await prisma.$queryRaw`
      SELECT 
        id,
        storage_key as "storageKey",
        filename,
        created_at as "createdAt"
      FROM evidence_files
      WHERE 
        storage_key LIKE 'http://%' 
        OR storage_key LIKE 'https://%'
        OR storage_key IS NULL
        OR storage_key = ''
      LIMIT 20
    `;
    
    console.log('Corrupted storageKey values found:', corrupted.length);
    if (corrupted.length > 0) {
      console.log(JSON.stringify(corrupted, null, 2));
    }
    
    // Check total count
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM evidence_files
    `;
    console.log('\nTotal evidence_files:', countResult[0]?.total || 0);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkStorageKeys();
