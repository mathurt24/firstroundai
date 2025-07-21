import { defineConfig, presetUno, presetAttributify, presetIcons, presetWind } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons(),
    presetWind(), // for Tailwind CSS compatibility
  ],
  // Add custom rules or shortcuts here if needed
}); 