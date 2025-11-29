import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatePath = path.join(__dirname, '../public/firebase-messaging-sw-template.js');
const outputPath = path.join(__dirname, '../public/firebase-messaging-sw.js');

try {
    let content = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders with environment variables
    const replacements = {
        '{{VITE_FIREBASE_API_KEY}}': process.env.VITE_FIREBASE_API_KEY,
        '{{VITE_FIREBASE_AUTH_DOMAIN}}': process.env.VITE_FIREBASE_AUTH_DOMAIN,
        '{{VITE_FIREBASE_PROJECT_ID}}': process.env.VITE_FIREBASE_PROJECT_ID,
        '{{VITE_FIREBASE_STORAGE_BUCKET}}': process.env.VITE_FIREBASE_STORAGE_BUCKET,
        '{{VITE_FIREBASE_MESSAGING_SENDER_ID}}': process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        '{{VITE_FIREBASE_APP_ID}}': process.env.VITE_FIREBASE_APP_ID,
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
        if (!value) {
            console.warn(`Warning: Environment variable for ${placeholder} is missing.`);
        }
        content = content.replace(placeholder, value || '');
    }

    fs.writeFileSync(outputPath, content);
    console.log('✅ firebase-messaging-sw.js generated successfully.');
} catch (error) {
    console.error('❌ Error generating firebase-messaging-sw.js:', error);
    process.exit(1);
}
