import { ChallengeType, CHALLENGE_TYPES, JWT_SECRET } from './security';
import db from './db';
import crypto from 'crypto';

export interface ChallengeData {
  type: ChallengeType;
  question: string;
  options?: string[];
  token: string;
  rayId: string;
}

const CHALLENGE_SECRET = JWT_SECRET;

async function signData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(CHALLENGE_SECRET);
  const dataData = encoder.encode(data);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataData);
  const hashArray = Array.from(new Uint8Array(signature));
  return btoa(hashArray.map((b) => String.fromCharCode(b)).join(''));
}

async function verifyData(data: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(CHALLENGE_SECRET);
    const dataData = encoder.encode(data);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const decodedSignature = atob(signature);
    const signatureBytes = new Uint8Array(decodedSignature.length);
    for (let i = 0; i < decodedSignature.length; i++) {
      signatureBytes[i] = decodedSignature.charCodeAt(i);
    }
    return await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, dataData);
  } catch {
    return false;
  }
}

export async function verifyChallengeToken(
  token: string,
  solution: string,
  metaOnly = false,
): Promise<boolean> {
  try {
    const [type, expiryStr, rayId, metaSig, answerSig] = token.split('.');
    const expiry = parseInt(expiryStr, 10);

    if (isNaN(expiry) || expiry < Date.now()) return false;

    const metaData = `${type}|${expiry}|${rayId}`;
    if (!(await verifyData(metaData, metaSig))) return false;
    if (metaOnly) return true;

    const answerData = `${type}|${expiry}|${rayId}|${solution}`;
    return await verifyData(answerData, answerSig);
  } catch {
    return false;
  }
}

export async function generateChallenge(): Promise<ChallengeData> {
  const types = await getEnabledChallengeTypes();
  const type = types[Math.floor(Math.random() * types.length)] || 'MATH';
  const expiry = Date.now() + 1000 * 60 * 5; // 5 minutes
  const rayId = crypto.randomBytes(8).toString('hex');

  let question = '';
  let answer = '';
  let options: string[] | undefined;

  switch (type) {
    case 'IMAGE': {
      const sets = [
        { label: 'cars', images: ['car1', 'car2', 'car3'], others: ['bus', 'bike', 'truck'] },
        { label: 'cats', images: ['cat1', 'cat2', 'cat3'], others: ['dog', 'bird', 'fish'] },
      ];
      const set = sets[Math.floor(Math.random() * sets.length)];
      question = `Select all images containing ${set.label}`;
      const allItems = [
        ...set.images.map((id) => ({ id, correct: true })),
        ...set.others.map((id) => ({ id, correct: false })),
      ].sort(() => Math.random() - 0.5);

      const correctIndices = allItems
        .map((item, index) => (item.correct ? index : -1))
        .filter((index) => index !== -1)
        .sort((a, b) => a - b)
        .join(',');

      answer = correctIndices;
      const tempToken = 'temp'; // Temporary token for image URLs
      options = allItems.map(
        (item) => `/api/security/images?id=${item.id}&rayId=${rayId}&token=${tempToken}`,
      );
      break;
    }
    case 'MATH': {
      const a = Math.floor(Math.random() * 10) + 1;
      const b = Math.floor(Math.random() * 10) + 1;
      question = `What is ${a} + ${b}?`;
      answer = (a + b).toString();
      break;
    }
    case 'TEXT': {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      answer = '';
      for (let i = 0; i < 6; i++) answer += chars.charAt(Math.floor(Math.random() * chars.length));
      question = 'Type the characters you see (case-insensitive)';
      options = [answer]; // For demo, we'll provide the distorted text directly
      break;
    }
    case 'CLICK':
    default: {
      question = 'Hold the button for 3 seconds';
      answer = 'HOLD_SUCCESS';
      break;
    }
  }

  const metaData = `${type}|${expiry}|${rayId}`;
  const metaSig = await signData(metaData);
  const answerData = `${type}|${expiry}|${rayId}|${answer}`;
  const answerSig = await signData(answerData);

  const token = [type, expiry, rayId, metaSig, answerSig].join('.');

  // Now update the options with the real token
  if (type === 'IMAGE' && options) {
    options = options.map((opt) => opt.replace('token=temp', `token=${token}`));
  }

  return { type, question, options, token, rayId };
}

// ... getEnabledChallengeTypes ...
async function getEnabledChallengeTypes(): Promise<ChallengeType[]> {
  try {
    const result = await db.query(
      'SELECT value FROM "GlobalSetting" WHERE key = \'CHALLENGE_TYPES\'',
    );
    if (result.rows.length > 0) {
      return result.rows[0].value.split(',') as ChallengeType[];
    }
  } catch (e) {
    console.error('Error fetching challenge types:', e);
  }
  return [...CHALLENGE_TYPES];
}
