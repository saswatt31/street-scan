import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function analyzeImage(buffer: Buffer, mimeType: string) {
  // We need to send this to the YOLO FastAPI service at localhost:8000/analyze
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  const formData = new FormData();
  formData.append('file', blob, 'image.jpg');

  const yoloUrl = process.env.NEXT_PUBLIC_YOLO_SERVICE_URL || 'http://localhost:8000';
  const yoloKey = process.env.YOLO_API_KEY || 'dev-yolo-secret';

  // Basic validation of YOLO URL to avoid common placeholder errors
  if (yoloUrl.includes('render.com/docs')) {
    console.warn('[AI] YOLO URL appears to be a documentation link. Skipping YOLO analysis.');
    throw new Error('YOLO service not configured');
  }

  try {
    const response = await fetch(`${yoloUrl}/analyze`, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Api-Key': yoloKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`YOLO service returned ${response.status}: ${text.substring(0, 100)}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error calling YOLO service:', error.message);
    throw error;
  }
}

export async function validateVisualDamage(buffer: Buffer, mimeType: string, options: { vibration_rms?: number, description?: string, damage_type: string }) {
  // 1. Run YOLO analysis
  let yoloData = null;
  try {
    yoloData = await analyzeImage(buffer, mimeType);
  } catch (e) {
    console.warn('YOLO service unavailable or misconfigured, proceeding with Gemini only.');
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

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    // Attempt to extract JSON from response
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1] || jsonMatch[0];
    }
    
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.error('Gemini error or failed to parse response:', error.message);
    // Fallback response if AI fails
    return {
      damage: true, // Optimistic fallback if AI is flaky
      explanation: "AI validation encountered an error, but proceeding with caution.",
      damage_type: options.damage_type,
      severity: "medium",
      score: 50,
      confidence: 0.5,
      notes: "System fallback due to AI service error."
    };
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
