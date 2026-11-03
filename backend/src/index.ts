import { createApp } from './app';
import { config, assertProductionSecrets } from './config';
import { prisma } from './lib/prisma';

async function startServer() {
  try {
    assertProductionSecrets();

    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    const app = createApp();
    
    const server = app.listen(config.port, config.host, () => {
      console.log(`🚀 ZIQWEAR Backend running on http://${config.host}:${config.port}`);
      console.log(`📍 Environment: ${config.nodeEnv}`);
      console.log(`🔗 API: http://localhost:${config.port}${config.apiPrefix}`);
    });
    
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Database disconnected');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();