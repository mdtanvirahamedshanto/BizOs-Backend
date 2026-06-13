import fs from 'fs';
import path from 'path';

const srcDir = path.join(__dirname, 'src');

function walk(dir: string, callback: (filePath: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, callback);
    } else if (filePath.endsWith('.ts')) {
      callback(filePath);
    }
  }
}

function fixImports() {
  walk(srcDir, (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    // Replace ../../common/utils -> @/utils, etc
    // Actually, let's just replace all relative imports that go up directories
    // or point to common/modules with @/...
    
    // We can do this manually for the known ones:
    const replacements: [RegExp, string][] = [
      [/'\.\.\/\.\.\/common\/utils\/([^']+)'/g, "'@/utils/$1'"],
      [/'\.\.\/\.\.\/common\/events\/([^']+)'/g, "'@/events/$1'"],
      [/'\.\.\/\.\.\/common\/types\/([^']+)'/g, "'@/types/$1'"],
      [/'\.\.\/\.\.\/common\/errors([^']*)'/g, "'@/utils/errors$1'"],
      [/'\.\.\/errors'/g, "'@/utils/errors'"],
      [/'\.\.\/\.\.\/common\/queues\/([^']+)'/g, "'@/queues/$1'"],
      [/'\.\.\/queues\/([^']+)'/g, "'@/queues/$1'"],
      [/'\.\.\/common\/types\/([^']+)'/g, "'@/types/$1'"],
      [/'\.\.\/common\/utils\/([^']+)'/g, "'@/utils/$1'"],
      
      // auth controller -> auth.service
      [/'\.\/auth\.service'/g, "'@/services/auth.service'"],
      // auth service -> auth.repository
      [/'\.\/auth\.repository'/g, "'@/repositories/auth.repository'"],
      [/'\.\/auth\.types'/g, "'@/types/auth.types'"],
      [/'\.\/auth\.events'/g, "'@/events/auth.events'"],
      [/'\.\/auth\.schema'/g, "'@/validators/auth.schema'"],
      
      // tenant.service (not yet moved but referenced)
      [/'\.\.\/tenant\/tenant\.service'/g, "'@/services/tenant.service'"],

      // env config
      [/'\.\.\/\.\.\/env'/g, "'@/env'"],
      [/'\.\.\/env'/g, "'@/env'"],
      [/'\.\.\/config\/([^']+)'/g, "'@/config/$1'"],
      [/'\.\.\/\.\.\/config\/([^']+)'/g, "'@/config/$1'"],
    ];

    for (const [regex, replacement] of replacements) {
      const newContent = content.replace(regex, replacement);
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`Updated ${filePath}`);
    }
  });
}

fixImports();
