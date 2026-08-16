import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const ideDir = path.join(rootDir, 'slr-ide');
const viewerDir = path.join(rootDir, 'slr-viewer');

console.log('🔄 Starting SLR Code Mirroring (slr-ide -> slr-viewer)...');

// Helper to ensure target directory exists
function ensureDir(targetPath) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper to copy a single file with optional comment header
function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ Source file not found: ${src}`);
    return false;
  }
  ensureDir(dest);
  const content = fs.readFileSync(src, 'utf8');
  fs.writeFileSync(dest, content, 'utf8');
  console.log(`  ✓ Mirrored: ${path.relative(rootDir, src)} -> ${path.relative(rootDir, dest)}`);
  return true;
}

// Helper to recursively copy a directory
function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`⚠️ Source directory not found: ${srcDir}`);
    return;
  }
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✓ Mirrored: ${path.relative(rootDir, srcPath)} -> ${path.relative(rootDir, destPath)}`);
    }
  }
}

// 1. Mirror Pure Services & Calculation Libraries
console.log('\n[1/5] Mirroring Pure Services & Domain Calculators...');
copyFile(
  path.join(ideDir, 'src/lib/services/cohort-metrics.ts'),
  path.join(viewerDir, 'src/lib/services/cohort-metrics.ts')
);
copyFile(
  path.join(ideDir, 'src/lib/services/taxonomy-resolver.ts'),
  path.join(viewerDir, 'src/lib/services/taxonomy-resolver.ts')
);
copyFile(
  path.join(ideDir, 'src/lib/services/trace-normalizer.ts'),
  path.join(viewerDir, 'src/lib/services/trace-normalizer.ts')
);

// 2. Mirror Types
console.log('\n[2/5] Mirroring Types...');
copyFile(
  path.join(ideDir, 'src/types/index.ts'),
  path.join(viewerDir, 'src/types/index.ts')
);

// 3. Mirror Visualizer Module (All 18 Chart Generators, Hooks, Constants, Types)
console.log('\n[3/5] Mirroring Visualizer Module...');
copyDir(
  path.join(ideDir, 'src/components/features/modals/visualizer'),
  path.join(viewerDir, 'src/components/final-cohort/visualizer')
);

// 4. Mirror Modals
console.log('\n[4/5] Mirroring Modals...');
copyFile(
  path.join(ideDir, 'src/components/features/modals/VisualizerModal.tsx'),
  path.join(viewerDir, 'src/components/final-cohort/VisualizerModal.tsx')
);
copyFile(
  path.join(ideDir, 'src/components/features/modals/LlmContextBuilderModal.tsx'),
  path.join(viewerDir, 'src/components/final-cohort/LlmContextBuilderModal.tsx')
);
copyFile(
  path.join(ideDir, 'src/components/features/modals/PrismaConfigModal.tsx'),
  path.join(viewerDir, 'src/components/features/modals/PrismaConfigModal.tsx')
);
copyFile(
  path.join(ideDir, 'src/components/features/modals/PrismaConfigModal.tsx'),
  path.join(viewerDir, 'src/components/scientific-rigor/PrismaConfigModal.tsx')
);

// 5. Mirror Presentation Panels
console.log('\n[5/5] Mirroring Feature Panels...');
copyFile(
  path.join(ideDir, 'src/components/features/insight-export/PrismaFlowDiagram.tsx'),
  path.join(viewerDir, 'src/components/scientific-rigor/PrismaFlowDiagram.tsx')
);
copyFile(
  path.join(ideDir, 'src/components/features/insight-export/AccountingPanel.tsx'),
  path.join(viewerDir, 'src/components/accounting/AccountingPanel.tsx')
);
copyFile(
  path.join(ideDir, 'src/components/features/pre-calibration/StageComparisonPanel.tsx'),
  path.join(viewerDir, 'src/components/scientific-rigor/StageComparisonPanel.tsx')
);
copyFile(
  path.join(ideDir, 'src/components/features/pre-calibration/PoolMetricsPanel.tsx'),
  path.join(viewerDir, 'src/components/scientific-rigor/PoolMetricsPanel.tsx')
);
copyFile(
  path.join(ideDir, 'src/components/features/pre-calibration/BlindedAdjudicationPanel.tsx'),
  path.join(viewerDir, 'src/components/scientific-rigor/BlindedAdjudicationPanel.tsx')
);

console.log('\n✨ Code Mirroring Complete! All shared components and services are synchronized.\n');
