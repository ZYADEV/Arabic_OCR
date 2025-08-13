// Minimal Arabic shaping to presentation forms for environments without complex text shaping
// This covers the most common Arabic letters and Lam-Alef ligatures.

type Forms = { isolated: string; initial?: string; medial?: string; final?: string; joinL?: boolean; joinR?: boolean };

// Joining behavior: Letters that connect to the next (joinL) and/or previous (joinR)
// Non-connecting to next (right-joining only): Alef(0627,0622,0623,0625), Dal(062F), Thal(0630), Ra(0631), Zain(0632), Waw(0648)
const MAP: Record<string, Forms> = {
  // Beh group
  '\u0628': { isolated: '\uFE8F', initial: '\uFE91', medial: '\uFE92', final: '\uFE90', joinL: true, joinR: true },
  '\u062A': { isolated: '\uFE95', initial: '\uFE97', medial: '\uFE98', final: '\uFE96', joinL: true, joinR: true },
  '\u062B': { isolated: '\uFE99', initial: '\uFE9B', medial: '\uFE9C', final: '\uFE9A', joinL: true, joinR: true },
  '\u062C': { isolated: '\uFE9D', initial: '\uFE9F', medial: '\uFEA0', final: '\uFE9E', joinL: true, joinR: true },
  '\u062D': { isolated: '\uFEA1', initial: '\uFEA3', medial: '\uFEA4', final: '\uFEA2', joinL: true, joinR: true },
  '\u062E': { isolated: '\uFEA5', initial: '\uFEA7', medial: '\uFEA8', final: '\uFEA6', joinL: true, joinR: true },
  '\u062F': { isolated: '\uFEA9', final: '\uFEAA', joinL: false, joinR: true },
  '\u0630': { isolated: '\uFEAB', final: '\uFEAC', joinL: false, joinR: true },
  '\u0631': { isolated: '\uFEAD', final: '\uFEAE', joinL: false, joinR: true },
  '\u0632': { isolated: '\uFEAF', final: '\uFEB0', joinL: false, joinR: true },
  '\u0633': { isolated: '\uFEB1', initial: '\uFEB3', medial: '\uFEB4', final: '\uFEB2', joinL: true, joinR: true },
  '\u0634': { isolated: '\uFEB5', initial: '\uFEB7', medial: '\uFEB8', final: '\uFEB6', joinL: true, joinR: true },
  '\u0635': { isolated: '\uFEB9', initial: '\uFEBB', medial: '\uFEBC', final: '\uFEBA', joinL: true, joinR: true },
  '\u0636': { isolated: '\uFEBD', initial: '\uFEBF', medial: '\uFEC0', final: '\uFEBE', joinL: true, joinR: true },
  '\u0637': { isolated: '\uFEC1', initial: '\uFEC3', medial: '\uFEC4', final: '\uFEC2', joinL: true, joinR: true },
  '\u0638': { isolated: '\uFEC5', initial: '\uFEC7', medial: '\uFEC8', final: '\uFEC6', joinL: true, joinR: true },
  '\u0639': { isolated: '\uFEC9', initial: '\uFECB', medial: '\uFECC', final: '\uFECA', joinL: true, joinR: true },
  '\u063A': { isolated: '\uFECD', initial: '\uFECF', medial: '\uFED0', final: '\uFECE', joinL: true, joinR: true },
  '\u0641': { isolated: '\uFED1', initial: '\uFED3', medial: '\uFED4', final: '\uFED2', joinL: true, joinR: true },
  '\u0642': { isolated: '\uFED5', initial: '\uFED7', medial: '\uFED8', final: '\uFED6', joinL: true, joinR: true },
  '\u0643': { isolated: '\uFED9', initial: '\uFEDB', medial: '\uFEDC', final: '\uFEDA', joinL: true, joinR: true },
  '\u0644': { isolated: '\uFEDD', initial: '\uFEDF', medial: '\uFEE0', final: '\uFEDE', joinL: true, joinR: true },
  '\u0645': { isolated: '\uFEE1', initial: '\uFEE3', medial: '\uFEE4', final: '\uFEE2', joinL: true, joinR: true },
  '\u0646': { isolated: '\uFEE5', initial: '\uFEE7', medial: '\uFEE8', final: '\uFEE6', joinL: true, joinR: true },
  '\u0647': { isolated: '\uFEE9', initial: '\uFEEB', medial: '\uFEEC', final: '\uFEEA', joinL: true, joinR: true },
  '\u0648': { isolated: '\uFEED', final: '\uFEEE', joinL: false, joinR: true },
  '\u064A': { isolated: '\uFEF1', initial: '\uFEF3', medial: '\uFEF4', final: '\uFEF2', joinL: true, joinR: true },
  // Alef variants
  '\u0627': { isolated: '\uFE8D', final: '\uFE8E', joinL: false, joinR: true },
  '\u0622': { isolated: '\uFE81', final: '\uFE82', joinL: false, joinR: true },
  '\u0623': { isolated: '\uFE83', final: '\uFE84', joinL: false, joinR: true },
  '\u0625': { isolated: '\uFE87', final: '\uFE88', joinL: false, joinR: true },
  // Teh marbuta
  '\u0629': { isolated: '\uFE93', final: '\uFE94', joinL: false, joinR: true },
};

const LAM = '\u0644';
const ALEF = '\u0627';
const ALEF_MADDA = '\u0622';
const ALEF_HAMZA = '\u0623';
const ALEF_HAMZA_BELOW = '\u0625';

const LIG_LA = '\uFEFB'; // lam-alef isolated
const LIG_LA_FINAL = '\uFEFC';
const LIG_LA_MADDA = '\uFEF5';
const LIG_LA_MADDA_FINAL = '\uFEF6';
const LIG_LA_HAMZA = '\uFEF7';
const LIG_LA_HAMZA_FINAL = '\uFEF8';
const LIG_LA_HAMZA_BELOW = '\uFEF9';
const LIG_LA_HAMZA_BELOW_FINAL = '\uFEFA';

function isArabicLetter(ch: string): boolean {
  return /[\u0600-\u06FF]/.test(ch);
}

function canJoinPrev(ch: string): boolean {
  const f = MAP[ch];
  return !!(f && f.joinR);
}

function canJoinNext(ch: string): boolean {
  const f = MAP[ch];
  return !!(f && f.joinL);
}

export function shapeArabicText(input: string): string {
  const chars = Array.from(input);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i];
    const next = chars[i + 1];
    const prev = out.length ? out[out.length - 1] : '';

    // Lam-Alef ligatures
    if (ch === LAM && (next === ALEF || next === ALEF_MADDA || next === ALEF_HAMZA || next === ALEF_HAMZA_BELOW)) {
      const prevCanJoin = isArabicLetter(prev) && canJoinNext(prev);
      let lig = LIG_LA;
      if (next === ALEF_MADDA) lig = prevCanJoin ? LIG_LA_MADDA_FINAL : LIG_LA_MADDA;
      else if (next === ALEF_HAMZA) lig = prevCanJoin ? LIG_LA_HAMZA_FINAL : LIG_LA_HAMZA;
      else if (next === ALEF_HAMZA_BELOW) lig = prevCanJoin ? LIG_LA_HAMZA_BELOW_FINAL : LIG_LA_HAMZA_BELOW;
      else lig = prevCanJoin ? LIG_LA_FINAL : LIG_LA;
      out.push(lig);
      i++; // skip alef
      continue;
    }

    const forms = MAP[ch];
    if (!forms) { out.push(ch); continue; }

    const prevChar = chars[i - 1];
    const nextChar = chars[i + 1];
    const joinsWithPrev = isArabicLetter(prevChar) && canJoinNext(prevChar) && canJoinPrev(ch);
    const joinsWithNext = isArabicLetter(nextChar) && canJoinNext(ch) && canJoinPrev(nextChar);

    if (joinsWithPrev && joinsWithNext && forms.medial) out.push(forms.medial);
    else if (joinsWithPrev && forms.final) out.push(forms.final);
    else if (joinsWithNext && forms.initial) out.push(forms.initial);
    else out.push(forms.isolated);
  }

  return out.join('');
}

// Remove combining marks (tashkeel), tatweel and zero-width/control characters that render as boxes
export function sanitizeArabicText(input: string): string {
  return input
    // Remove Arabic diacritics and Quranic annotation marks
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // Remove tatweel/kashida
    .replace(/\u0640/g, '')
    // Remove zero-width and bidi control marks that often leak from OCR
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    // Normalize punctuation to Arabic glyphs
    .replace(/\?/g, '؟')
    .replace(/;/g, '؛')
    // Collapse spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}


