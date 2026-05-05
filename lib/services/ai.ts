import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function analyzeImage(buffer: Buffer, mimeType: string) {
  // We need to send this to the YOLO FastAPI service at localhost:8000/analyze
  const blob = new Blob([buffer], { type: mimeType });
  const formData = new FormData();
  formData.append('file', blob, 'image.jpg');

  const yoloUrl = process.env.NEXT_PUBLIC_YOLO_SERVICE_URL || 'http://localhost:8000';
  const yoloKey = process.env.YOLO_API_KEY || 'dev-yolo-secret';

  try {
    const response = await fetch(`${yoloUrl}/analyze`, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Api-Key': yoloKey,
      },
    });

    if (!response.ok) {
      throw new Error(`YOLO service returned ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling YOLO service:', error);
    throw error;
  }
}

export async function validateVisualDamage(buffer: Buffer, mimeType: string, options: { vibration_rms?: number, description?: string, damage_type: string }) {
  // 1. Run YOLO analysis
  let yoloData;
  try {
    yoloData = await analyzeImage(buffer, mimeType);
  } catch (e) {
    console.warn('YOLO service unavailable, proceeding with Gemini only.');
  }

  // 2. Prepare prompt for Gemini
  const prompt = `
    You are an expert infrastructure health monitor AI. 
    Analyze the provided image of a reported road/infrastructure damage.
    
    Context provided by the user:
    - Damage Type: ${options.damage_type}
    - Description: ${options.description || 'None'}
    - Vibration RMS (IoT Sensor): ${options.vibration_rms || 'N/A'}
    
    Context provided by edge YOLO vision system:
    ${yoloData ? JSON.stringify(yoloData) : 'Not available'}
    
    Determine if there is verifiable damage in the image.
    If damage is found, assess its severity (low, medium, high, critical) and score it from 0 to 100.
    
    Respond STRICTLY in the following JSON format:
    {
      "damage": boolean,
      "explanation": "Brief explanation of your findings",
      "damage_type": "The classified damage type",
      "severity": "low|medium|high|critical",
      "score": number,
      "confidence": number,
      "notes": "Any additional technical notes"
    }
  `;

  // 3. Call Gemini
  const imagePart = {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType
    }
  };

  const result = await model.generateContent([prompt, imagePart]);
  const responseText = result.response.text();
  
  try {
    // Attempt to extract JSON from markdown if wrapped
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json\n|```/g, '') : responseText;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse Gemini response:', responseText);
    throw new Error('Invalid response from AI model');
  }
}

export async function analyzeVibration(options: { vibration_rms: number, magnitude: number, frequency_hz?: number }) {
  // Functional stub based on simple thresholds
  const rms = options.vibration_rms;
  const isDamage = rms > 1.5; 
  
  return {
    damage: isDamage,
    damage_type: isDamage ? 'pothole' : 'none',
    severity: rms > 3 ? 'high' : (rms > 2 ? 'medium' : 'low'),
    score: Math.min(100, Math.round(rms * 20))
  };
}

export async function verifyResolution(beforeBuffer: Buffer | null, afterBuffer: Buffer, mimeType: string) {
  // Stub for now. Resolves tickets cleanly.
  return {
    verified: true,
    notes: 'Auto-verified by AI service stub.'
  };
}
