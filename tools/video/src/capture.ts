import { join } from 'node:path';
import { SHOTS as SHOT_DIR } from './paths.js';
import { Recorder } from './recorder.js';
import { SHOTS } from './shots.js';

// pnpm capture <shot ...|all>
// Records each shot against the live link into out/shots/<shot>/.

const asked = process.argv.slice(2);
const names = asked.length === 0 || asked.includes('all') ? Object.keys(SHOTS) : asked;

for (const name of names) {
  const shot = SHOTS[name];
  if (!shot) {
    console.error(`Unknown shot "${name}". Shots: ${Object.keys(SHOTS).join(', ')}`);
    process.exit(1);
  }
  console.log(`\n== ${name}: ${shot.description}\n`);
  const rec = await Recorder.start({ name, dir: join(SHOT_DIR, name), viewport: shot.viewport });
  try {
    await shot.run(rec);
  } catch (err) {
    rec.mark(`FAILED: ${(err as Error).message}`);
    await rec.stop();
    console.error(`\nShot "${name}" failed; partial recording kept.`);
    throw err;
  }
  await rec.stop();
}
