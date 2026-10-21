import { defineConfig } from 'vite';
import { createProductConfig } from './config/vite-product-config.mjs';

export default defineConfig(() => createProductConfig({ mode: 'production' }));
