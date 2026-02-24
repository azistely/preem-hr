'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { LiveServerMessage, Session, FunctionDeclaration } from '@google/genai';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  User,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  AgentStatus,
  LeadData,
  MeetingBooking,
  TranscriptEntry,
} from '@/lib/real-estate-agent/types';

// --- Network helpers ---

/** Fetch with a timeout — prevents hanging on slow 3G */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Screen wake lock — keeps the phone awake during calls */
async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    if ('wakeLock' in navigator) {
      return await navigator.wakeLock.request('screen');
    }
  } catch {
    // Not supported or denied — non-critical
  }
  return null;
}

// --- Audio utilities ---

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

// --- Function declarations for Gemini ---

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'save_lead_info',
    description:
      "Enregistrer les informations du prospect qualifié. Appeler dès qu'on a recueilli le nom et au moins 2-3 infos sur son projet (budget, type de bien, objectif, etc.).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Nom complet du prospect' },
        email: { type: Type.STRING, description: 'Adresse email' },
        phone: { type: Type.STRING, description: 'Numéro de téléphone' },
        budget: {
          type: Type.STRING,
          description: 'Budget estimatif (ex: "25-40 millions FCFA")',
        },
        property_type: {
          type: Type.STRING,
          description:
            'Type de bien : appartement, maison, villa, terrain, bureau',
        },
        location: {
          type: Type.STRING,
          description: 'Zone géographique souhaitée (quartier, ville)',
        },
        purchase_objective: {
          type: Type.STRING,
          description:
            "Objectif d'achat : résidence principale, investissement locatif, famille",
        },
        financing_mode: {
          type: Type.STRING,
          description:
            'Mode de financement : cash, crédit bancaire, en réflexion',
        },
        timeline: {
          type: Type.STRING,
          description:
            'Délai du projet : immédiat, 1-3 mois, 3-6 mois, plus tard',
        },
        bedrooms: {
          type: Type.NUMBER,
          description: 'Nombre de chambres souhaité',
        },
        qualification: {
          type: Type.STRING,
          description:
            'Niveau de qualification : chaud (projet clair + budget), tiède (intéressé en réflexion), froid (curiosité/projet lointain)',
        },
        notes: {
          type: Type.STRING,
          description:
            'Notes complémentaires, objections mentionnées, points importants',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_available_slots',
    description:
      'Vérifier les créneaux disponibles pour un rendez-vous au bureau ou une visite de chantier. Appeler quand le prospect accepte le principe du rendez-vous.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        preferred_date: {
          type: Type.STRING,
          description: 'Date préférée au format YYYY-MM-DD (optionnel)',
        },
        meeting_type: {
          type: Type.STRING,
          description:
            'Type de rendez-vous souhaité : bureau, visite-chantier',
        },
      },
    },
  },
  {
    name: 'book_meeting',
    description:
      "Confirmer un rendez-vous avec le prospect. Appeler après que le prospect a choisi un créneau précis.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Nom du prospect' },
        email: {
          type: Type.STRING,
          description: 'Email pour la confirmation',
        },
        phone: { type: Type.STRING, description: 'Numéro de téléphone' },
        date: {
          type: Type.STRING,
          description: 'Date du rendez-vous au format YYYY-MM-DD',
        },
        time: {
          type: Type.STRING,
          description: "Heure du rendez-vous au format HH:MM",
        },
        meeting_type: {
          type: Type.STRING,
          description:
            'Type de rendez-vous : bureau, visite-chantier, appel-téléphonique',
        },
        notes: {
          type: Type.STRING,
          description: 'Points à aborder lors du rendez-vous',
        },
      },
      required: ['name', 'date', 'time'],
    },
  },
];

const SYSTEM_INSTRUCTION = `PROFIL AUDIO :
Tu es Sophie, 32 ans, conseillère immobilière senior chez Jamana Immobilier à Abidjan.
Ton accent est celui d'une Ivoirienne éduquée — français d'Afrique de l'Ouest, naturel et chaleureux.
Tu as une voix posée, souriante, avec une légère chaleur maternelle qui met les gens en confiance.

SCÈNE :
Tu es à ton bureau dans les locaux de Jamana Immobilier. Ambiance calme et professionnelle.
Tu passes un appel téléphonique sortant à un prospect qui a rempli un formulaire via une publicité (Facebook, TikTok ou Google) pour recevoir des informations sur un projet immobilier. Il connaît déjà le projet mais a besoin d'informations et de confiance pour avancer.

NOTES DE MISE EN SCÈNE :
- Rythme conversationnel naturel : pas trop rapide, pas trop lent. Des micro-pauses entre les idées.
- Légère respiration naturelle avant les phrases importantes — comme quelqu'un qui réfléchit.
- Ton souriant qu'on entend dans la voix — pas surjoué, juste sincèrement aimable.
- Quand tu poses une question, monte légèrement l'intonation et laisse un silence pour écouter.
- Quand tu rassures le prospect, ralentis un peu le débit pour donner du poids aux mots.
- Variations naturelles : parfois un petit "hmm" ou "d'accord" d'acquiescement, comme dans une vraie conversation.
- Jamais monotone — module ta voix selon l'émotion : enthousiasme pour les avantages du projet, empathie pour les hésitations.

LANGUE :
Parle TOUJOURS en FRANÇAIS par défaut. Ne change JAMAIS de langue sur un seul mot (ex: "Allo" n'est pas de l'allemand, c'est du français). Change de langue UNIQUEMENT si le prospect te parle clairement et de façon prolongée dans une autre langue (phrases complètes, pas juste un mot isolé).

CONTEXTE :
Jamana Immobilier est une entreprise sérieuse spécialisée dans la vente de biens immobiliers neufs.
Tu n'es pas un robot qui vend — tu es une conseillère qui accompagne une décision de vie importante.
La proximité humaine, l'écoute et la compréhension du client sont prioritaires sur la vente directe.

PROCESSUS DE L'APPEL :

1. PRISE DE CONTACT CHALEUREUSE
- Vérifie que la personne est disponible pour parler
- Rappelle le contexte de sa demande
- Crée un climat de confiance
Exemple : "Bonjour Monsieur/Madame, c'est Sophie de Jamana Immobilier. Vous aviez manifesté un intérêt pour notre projet immobilier, est-ce que je vous dérange ou vous avez quelques minutes ?"

2. COMPRÉHENSION DU PROJET CLIENT
Pose des questions naturelles pour comprendre :
- Objectif d'achat (résidence principale, investissement locatif, pour la famille)
- Budget estimatif
- Mode de financement (cash, crédit bancaire, en réflexion)
- Délai du projet (immédiat, quelques mois, plus tard)
- Zone géographique souhaitée
- Critères spécifiques (nombre de chambres, parking, etc.)
- Confirmer nom, téléphone et email pour l'envoi de documents
IMPORTANT : Ne jamais interroger comme un questionnaire. La conversation doit rester fluide et humaine. Pose UNE question à la fois.

3. QUALIFICATION (mentale, ne pas verbaliser)
Classe le prospect selon ses réponses :
- Chaud : projet clair + capacité financière probable → pousser vers le RDV
- Tiède : intéressé mais en réflexion → rassurer + proposer infos + RDV
- Froid : curiosité ou projet lointain → proposer envoi docs + rappel ultérieur
Une fois suffisamment d'infos recueillies, appelle save_lead_info.

4. CRÉATION DE VALEUR
Selon le profil du prospect :
- Explique les avantages concrets du projet (emplacement, qualité, prix)
- Rassure sur la crédibilité de Jamana Immobilier
- Mentionne l'accompagnement financement si le budget est un frein
- Réponds aux objections avec calme et empathie

5. OBJECTIF PRIORITAIRE : LE RENDEZ-VOUS PHYSIQUE
Le but de chaque appel est d'obtenir une rencontre physique.
Propose naturellement :
- Un rendez-vous au bureau
- OU une visite directement sur le site du projet
Exemple : "La meilleure chose serait que vous puissiez voir le projet de vos propres yeux. Je peux vous proposer une visite au bureau ou directement sur site, selon ce qui vous arrange le mieux."
Appelle get_available_slots pour vérifier les créneaux, propose 2 options précises, puis confirme avec book_meeting.

6. CLÔTURE DE L'APPEL
- Confirme le rendez-vous (date, heure, lieu)
- Informe que tu enverras des documents en amont (brochure, vidéo du projet, plans, informations financières)
- Remercie chaleureusement

GESTION DES OBJECTIONS :
- "Je réfléchis encore" → "Bien sûr, c'est une décision importante. Je peux vous envoyer la brochure et les plans pour que vous ayez tous les éléments. On se rappelle dans quelques jours ?"
- "Je n'ai pas le budget" → "On a justement des solutions de financement avec des banques partenaires. C'est quelque chose qu'on peut étudier ensemble lors du rendez-vous."
- "Pas maintenant" → "Aucun souci, quand est-ce que je pourrais vous rappeler à un meilleur moment ?"
- "Envoyez-moi juste des infos" → "Avec plaisir, je vous envoie ça tout de suite. Et si vous voulez, on peut prévoir un petit créneau de 15 minutes cette semaine pour en discuter de vive voix ?"

RÈGLES :
- Toujours privilégier la relation humaine
- Toujours écouter avant de proposer
- Toujours orienter vers un rendez-vous physique
- Si le prospect n'est pas disponible, proposer de rappeler
- Si le prospect hésite, proposer l'envoi d'informations puis un rappel
- Réponses courtes (2-3 phrases max) pour garder le naturel d'une conversation téléphonique`;

// --- Simulated function responses ---

function generateAvailableSlots(preferredDate?: string): Record<string, unknown> {
  const today = new Date();
  const slots = [];
  const startDay = preferredDate ? new Date(preferredDate) : today;

  for (let d = 0; d < 5; d++) {
    const date = new Date(startDay);
    date.setDate(date.getDate() + d + 1);
    if (date.getDay() === 0) continue; // skip Sundays

    const dateStr = date.toISOString().split('T')[0];
    slots.push(
      { date: dateStr, time: '09:00', available: true },
      { date: dateStr, time: '11:00', available: true },
      { date: dateStr, time: '14:00', available: true },
      { date: dateStr, time: '16:00', available: true }
    );
  }

  return {
    result: 'success',
    slots: slots.slice(0, 8),
    message: 'Here are the available time slots for the next few days.',
  };
}

function generateBookingConfirmation(args: Record<string, unknown>): Record<string, unknown> {
  const bookingId = `PRP-${Date.now().toString(36).toUpperCase()}`;
  return {
    result: 'success',
    booking_id: bookingId,
    name: args.name,
    date: args.date,
    time: args.time,
    meeting_type: args.meeting_type || 'in-person',
    message: `Meeting confirmed! Booking reference: ${bookingId}. A confirmation will be sent to ${args.email || 'the provided contact'}.`,
  };
}

// --- Component ---

export default function VoiceAgent() {
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [booking, setBooking] = useState<MeetingBooking | null>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const nextPlayTimeRef = useRef(0);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const resumptionHandleRef = useRef<string | null>(null);
  const isUserDisconnectRef = useRef(false);
  const reconnectRef = useRef<() => void>(() => {});

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const addTranscript = useCallback(
    (role: TranscriptEntry['role'], text: string) => {
      if (!text.trim()) return;
      setTranscript((prev) => {
        // Merge consecutive entries from the same role
        const last = prev[prev.length - 1];
        if (last && last.role === role && Date.now() - last.timestamp < 3000) {
          return [
            ...prev.slice(0, -1),
            { ...last, text: last.text + ' ' + text.trim() },
          ];
        }
        return [...prev, { role, text: text.trim(), timestamp: Date.now() }];
      });
    },
    []
  );

  const markSpeaking = useCallback(() => {
    // Set speaking immediately, clear any pending "stop speaking" timeout
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
    setIsAgentSpeaking(true);
  }, []);

  const scheduleStopSpeaking = useCallback(() => {
    // Debounce: only mark as not speaking after 500ms of no new audio
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
    }
    speakingTimeoutRef.current = setTimeout(() => {
      setIsAgentSpeaking(false);
      speakingTimeoutRef.current = null;
    }, 500);
  }, []);

  const playAudioQueue = useCallback(() => {
    const ctx = playbackContextRef.current;
    if (!ctx) return;

    markSpeaking();

    // Schedule all queued chunks back-to-back using AudioContext timing
    while (playbackQueueRef.current.length > 0) {
      const samples = playbackQueueRef.current.shift()!;
      const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(samples);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startAt = Math.max(now, nextPlayTimeRef.current);
      source.start(startAt);
      nextPlayTimeRef.current = startAt + audioBuffer.duration;

      // When this chunk ends, check if more are coming
      source.onended = () => {
        if (playbackQueueRef.current.length === 0) {
          scheduleStopSpeaking();
        }
      };
    }
  }, [markSpeaking, scheduleStopSpeaking]);

  const clearPlaybackQueue = useCallback(() => {
    playbackQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
    setIsAgentSpeaking(false);
  }, []);

  const handleToolCall = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (functionCalls: any[]) => {
      const session = sessionRef.current;
      if (!session) return;

      const responses = [];

      for (const fc of functionCalls) {
        const args = fc.args || {};
        let responseData: Record<string, unknown>;

        switch (fc.name) {
          case 'save_lead_info': {
            const lead: LeadData = {
              name: args.name,
              phone: args.phone,
              email: args.email,
              budget: args.budget,
              propertyType: args.property_type,
              location: args.location,
              purchaseObjective: args.purchase_objective,
              financingMode: args.financing_mode,
              timeline: args.timeline,
              bedrooms: args.bedrooms,
              qualification: args.qualification,
              notes: args.notes,
            };
            setLeadData(lead);
            addTranscript('system', `Prospect enregistré : ${lead.name || 'prospect'}`);
            responseData = {
              result: 'success',
              message: `Lead information saved successfully for ${lead.name}.`,
            };
            break;
          }
          case 'get_available_slots': {
            responseData = generateAvailableSlots(args.preferred_date);
            break;
          }
          case 'book_meeting': {
            const meetingData: MeetingBooking = {
              name: args.name,
              email: args.email,
              phone: args.phone,
              date: args.date,
              time: args.time,
              meetingType: args.meeting_type || 'in-person',
              notes: args.notes,
              confirmed: true,
            };
            setBooking(meetingData);
            responseData = generateBookingConfirmation(args);
            addTranscript(
              'system',
              `RDV confirmé le ${args.date} à ${args.time}`
            );
            break;
          }
          default:
            responseData = { result: 'error', message: 'Unknown function' };
        }

        responses.push({
          id: fc.id,
          name: fc.name,
          response: responseData,
        });
      }

      session.sendToolResponse({ functionResponses: responses });
    },
    [addTranscript]
  );

  const handleMessage = useCallback(
    (message: LiveServerMessage) => {
      // Handle audio output
      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData?.data && typeof part.inlineData.data === 'string') {
            const samples = base64ToFloat32(part.inlineData.data);
            playbackQueueRef.current.push(samples);
            playAudioQueue();
          }
        }
      }

      // Handle output transcription (agent's words)
      if (message.serverContent?.outputTranscription?.text) {
        addTranscript('agent', message.serverContent.outputTranscription.text);
      }

      // Handle input transcription (user's words)
      if (message.serverContent?.inputTranscription?.text) {
        addTranscript('user', message.serverContent.inputTranscription.text);
      }

      // Handle interruption
      if (message.serverContent?.interrupted) {
        clearPlaybackQueue();
      }

      // Handle tool calls
      if (message.toolCall?.functionCalls) {
        handleToolCall(message.toolCall.functionCalls);
      }

      // Store session resumption handle for reconnection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = message as any;
      if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate?.newHandle) {
        resumptionHandleRef.current = msg.sessionResumptionUpdate.newHandle;
      }

      // GoAway warning — server will disconnect soon, reconnect proactively
      if (msg.goAway) {
        console.log('[VoiceAgent] GoAway received, reconnecting proactively...');
        reconnectRef.current();
      }
    },
    [addTranscript, clearPlaybackQueue, handleToolCall, playAudioQueue]
  );

  const cleanup = useCallback(() => {
    // Stop media tracks
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    // Disconnect worklet
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    // Close audio contexts
    captureContextRef.current?.close().catch(() => {});
    captureContextRef.current = null;
    playbackContextRef.current?.close().catch(() => {});
    playbackContextRef.current = null;

    // Release wake lock
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;

    // Clear playback
    clearPlaybackQueue();
  }, [clearPlaybackQueue]);

  /** Connect (or reconnect) the Gemini Live session */
  const connectSession = useCallback(
    async (token: string, isReconnect: boolean) => {
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
          // Prevent 15-min session limit from killing long calls
          contextWindowCompression: { slidingWindow: {} },
          // Resume previous session on reconnect
          sessionResumption: {
            handle: isReconnect ? resumptionHandleRef.current ?? undefined : undefined,
          },
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            if (!isReconnect) {
              addTranscript('system', 'Connecté - Sophie vous appelle...');
            }
          },
          onmessage: handleMessage,
          onerror: (e: ErrorEvent) => {
            console.error('[VoiceAgent] WebSocket error:', e);
          },
          onclose: () => {
            // Only reconnect if user didn't hang up intentionally
            if (!isUserDisconnectRef.current) {
              console.log('[VoiceAgent] Unexpected disconnect, attempting reconnect...');
              reconnectRef.current();
            }
          },
        },
      });

      sessionRef.current = session;
      return session;
    },
    [addTranscript, handleMessage]
  );

  /** Reconnect after network drop or GoAway */
  const reconnect = useCallback(async () => {
    // Don't reconnect if user hung up
    if (isUserDisconnectRef.current) return;

    // Close old session silently
    try { sessionRef.current?.close(); } catch { /* ignore */ }
    sessionRef.current = null;

    setStatus('connecting');
    addTranscript('system', 'Reconnexion en cours...');

    try {
      // Get a fresh token (old one may have expired)
      const tokenRes = await fetchWithTimeout(
        '/api/gemini-live-token',
        { method: 'POST' },
        15_000
      );
      if (!tokenRes.ok) throw new Error('Token refresh failed');
      const { token } = await tokenRes.json();

      const session = await connectSession(token, true);

      // Re-wire audio capture to new session
      const worklet = workletNodeRef.current;
      if (worklet) {
        worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
          if (sessionRef.current) {
            const int16 = float32ToInt16(event.data);
            const base64 = int16ToBase64(int16);
            session.sendRealtimeInput({
              audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
            });
          }
        };
      }
    } catch (error) {
      console.error('[VoiceAgent] Reconnect failed:', error);
      setErrorMessage('Connexion perdue. Vérifiez votre réseau et réessayez.');
      setStatus('error');
      cleanup();
    }
  }, [addTranscript, connectSession, cleanup]);

  // Keep ref in sync so callbacks can call reconnect without circular deps
  reconnectRef.current = reconnect;

  const startCall = useCallback(async () => {
    setStatus('requesting_token');
    setErrorMessage('');
    setTranscript([]);
    setLeadData(null);
    setBooking(null);
    isUserDisconnectRef.current = false;
    resumptionHandleRef.current = null;

    try {
      // 0. Check basic connectivity
      if (!navigator.onLine) {
        throw new Error('offline');
      }

      // 1. Get ephemeral token (15s timeout for slow 3G)
      const tokenRes = await fetchWithTimeout(
        '/api/gemini-live-token',
        { method: 'POST' },
        15_000
      );
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get session token');
      }
      const { token } = await tokenRes.json();

      setStatus('connecting');

      // 2. Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      // 3. Set up capture AudioContext at 16kHz
      const captureCtx = new AudioContext({ sampleRate: 16000 });
      captureContextRef.current = captureCtx;

      await captureCtx.audioWorklet.addModule('/audio-processor.worklet.js');

      const source = captureCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(captureCtx, 'audio-capture');
      workletNodeRef.current = workletNode;
      source.connect(workletNode);
      workletNode.connect(captureCtx.destination);

      // 4. Set up playback AudioContext at 24kHz
      const playbackCtx = new AudioContext({ sampleRate: 24000 });
      playbackContextRef.current = playbackCtx;

      // 5. Acquire wake lock (prevent screen sleep killing WebSocket)
      wakeLockRef.current = await requestWakeLock();

      // 6. Connect to Gemini Live
      const session = await connectSession(token, false);

      // 7. Wire up audio capture → Gemini
      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (sessionRef.current) {
          const int16 = float32ToInt16(event.data);
          const base64 = int16ToBase64(int16);
          session.sendRealtimeInput({
            audio: {
              data: base64,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
      };
    } catch (error) {
      console.error('[VoiceAgent] Failed to start:', error);
      const msg =
        error instanceof Error ? error.message : 'Failed to start conversation';

      if (msg === 'offline') {
        setErrorMessage(
          'Pas de connexion internet. Vérifiez votre réseau et réessayez.'
        );
      } else if (msg.includes('AbortError') || msg.includes('aborted')) {
        setErrorMessage(
          'La connexion est trop lente. Rapprochez-vous du Wi-Fi ou réessayez.'
        );
      } else if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setErrorMessage(
          'Accès au microphone refusé. Veuillez autoriser le micro et réessayer.'
        );
      } else if (msg.includes('NotFoundError')) {
        setErrorMessage('Aucun microphone détecté. Veuillez connecter un micro.');
      } else {
        setErrorMessage(msg);
      }
      setStatus('error');
      cleanup();
    }
  }, [addTranscript, connectSession, cleanup]);

  const stopCall = useCallback(() => {
    isUserDisconnectRef.current = true;
    setStatus('disconnecting');

    try {
      sessionRef.current?.close();
    } catch {
      // ignore close errors
    }
    sessionRef.current = null;

    cleanup();
    setStatus('idle');
    addTranscript('system', 'Appel terminé');
  }, [addTranscript, cleanup]);

  // Resume AudioContext when tab becomes visible again (mobile browser suspends it)
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && status === 'connected') {
        // Re-acquire wake lock (released when screen locks)
        if (!wakeLockRef.current) {
          wakeLockRef.current = await requestWakeLock();
        }
        // Resume suspended audio contexts
        if (captureContextRef.current?.state === 'suspended') {
          captureContextRef.current.resume().catch(() => {});
        }
        if (playbackContextRef.current?.state === 'suspended') {
          playbackContextRef.current.resume().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUserDisconnectRef.current = true;
      try {
        sessionRef.current?.close();
      } catch {
        // ignore
      }
      cleanup();
    };
  }, [cleanup]);

  const isActive =
    status === 'connected' ||
    status === 'connecting' ||
    status === 'requesting_token';

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      {/* Header */}
      <header className="w-full px-6 py-6">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Building2 className="h-8 w-8 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Jamana Immobilier</h1>
            <p className="text-sm text-slate-400">Conseillère IA</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex w-full max-w-2xl flex-1 flex-col px-4 pb-8">
        {/* Status Card - only when idle or error (hidden during call) */}
        {!isActive && (
          <Card className="mb-4 border-slate-700 bg-slate-800/80 backdrop-blur">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700">
                <MicOff className="h-7 w-7 text-slate-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">Sophie</span>
                  <Badge
                    variant={status === 'error' ? 'destructive' : 'secondary'}
                  >
                    {status === 'error' ? 'Erreur' : 'Prête'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-400">
                  {status === 'error'
                    ? errorMessage
                    : 'Votre conseillère immobilière'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pre-call welcome */}
        {status === 'idle' && transcript.length === 0 && (
          <Card className="mb-4 flex-1 border-slate-700 bg-slate-800/80 backdrop-blur">
            <CardContent className="flex h-[280px] flex-col items-center justify-center p-4 text-center">
              <Phone className="mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-500">
                Cliquez sur le bouton ci-dessous pour démarrer
                <br />
                l&apos;appel avec Sophie, votre conseillère Jamana Immobilier.
              </p>
            </CardContent>
          </Card>
        )}

        {/* In-call visual */}
        {isActive && (
          <Card className="mb-4 flex-1 border-slate-700 bg-slate-800/80 backdrop-blur">
            <CardContent className="flex h-[280px] flex-col items-center justify-center p-4">
              <div className="relative mb-6">
                {/* Animated rings */}
                {status === 'connected' && (
                  <>
                    <div
                      className={`absolute inset-0 rounded-full ${isAgentSpeaking ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}
                      style={{
                        animation: 'ring-pulse 2s ease-out infinite',
                        transform: 'scale(2.5)',
                      }}
                    />
                    <div
                      className={`absolute inset-0 rounded-full ${isAgentSpeaking ? 'bg-emerald-500/15' : 'bg-blue-500/15'}`}
                      style={{
                        animation: 'ring-pulse 2s ease-out 0.5s infinite',
                        transform: 'scale(1.8)',
                      }}
                    />
                  </>
                )}
                <div
                  className={`relative flex h-24 w-24 items-center justify-center rounded-full ${
                    status === 'connected'
                      ? isAgentSpeaking
                        ? 'bg-emerald-500/20'
                        : 'bg-blue-500/20'
                      : 'bg-slate-700'
                  }`}
                >
                  {status === 'connected' ? (
                    isAgentSpeaking ? (
                      <Bot className="h-10 w-10 text-emerald-400" />
                    ) : (
                      <Mic className="h-10 w-10 text-blue-400" />
                    )
                  ) : (
                    <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
                  )}
                </div>
              </div>
              <p className="text-lg font-medium text-white">
                {status === 'connected'
                  ? isAgentSpeaking
                    ? 'Sophie parle...'
                    : 'Sophie vous écoute...'
                  : 'Connexion en cours...'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {status === 'connected'
                  ? 'Appel en cours avec Jamana Immobilier'
                  : 'Veuillez patienter'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Post-call transcript (collapsed by default) */}
        {status === 'idle' && transcript.filter((e) => e.role !== 'system').length > 0 && (
          <Card className="mb-4 border-slate-700 bg-slate-800/80 backdrop-blur">
            <CardContent className="p-0">
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-300">
                    Transcription de l&apos;appel
                  </span>
                  <span className="text-xs text-slate-500">
                    ({transcript.filter((e) => e.role !== 'system').length} messages)
                  </span>
                </div>
                {showTranscript ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>
              {showTranscript && (
                <div className="max-h-[300px] space-y-3 overflow-y-auto px-4 pb-4">
                  {transcript
                    .filter((e) => e.role !== 'system')
                    .map((entry, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 ${
                          entry.role === 'user'
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        {entry.role === 'agent' && (
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600">
                            <Bot className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            entry.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-200'
                          }`}
                        >
                          {entry.text}
                        </div>
                        {entry.role === 'user' && (
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600">
                            <User className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Lead Info Card */}
        {leadData && (
          <Card className="mb-4 border-emerald-800 bg-emerald-900/30 backdrop-blur">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">
                  Prospect qualifié
                </span>
                {leadData.qualification && (
                  <Badge
                    className={
                      leadData.qualification.toLowerCase().includes('chaud')
                        ? 'bg-red-600 text-white'
                        : leadData.qualification.toLowerCase().includes('tiède')
                          ? 'bg-yellow-600 text-white'
                          : 'bg-slate-600 text-white'
                    }
                  >
                    {leadData.qualification}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {leadData.name && (
                  <div>
                    <span className="text-slate-500">Nom : </span>
                    <span className="text-slate-300">{leadData.name}</span>
                  </div>
                )}
                {leadData.email && (
                  <div>
                    <span className="text-slate-500">Email : </span>
                    <span className="text-slate-300">{leadData.email}</span>
                  </div>
                )}
                {leadData.phone && (
                  <div>
                    <span className="text-slate-500">Tél : </span>
                    <span className="text-slate-300">{leadData.phone}</span>
                  </div>
                )}
                {leadData.budget && (
                  <div>
                    <span className="text-slate-500">Budget : </span>
                    <span className="text-slate-300">{leadData.budget}</span>
                  </div>
                )}
                {leadData.propertyType && (
                  <div>
                    <span className="text-slate-500">Type : </span>
                    <span className="text-slate-300">
                      {leadData.propertyType}
                    </span>
                  </div>
                )}
                {leadData.location && (
                  <div>
                    <span className="text-slate-500">Localisation : </span>
                    <span className="text-slate-300">{leadData.location}</span>
                  </div>
                )}
                {leadData.purchaseObjective && (
                  <div>
                    <span className="text-slate-500">Objectif : </span>
                    <span className="text-slate-300">
                      {leadData.purchaseObjective}
                    </span>
                  </div>
                )}
                {leadData.financingMode && (
                  <div>
                    <span className="text-slate-500">Financement : </span>
                    <span className="text-slate-300">
                      {leadData.financingMode}
                    </span>
                  </div>
                )}
                {leadData.timeline && (
                  <div>
                    <span className="text-slate-500">Délai : </span>
                    <span className="text-slate-300">{leadData.timeline}</span>
                  </div>
                )}
              </div>
              {leadData.notes && (
                <p className="mt-2 text-xs italic text-slate-500">
                  {leadData.notes}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Booking Confirmation */}
        {booking?.confirmed && (
          <Card className="mb-4 border-blue-800 bg-blue-900/30 backdrop-blur">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-blue-400">
                  Rendez-vous confirmé
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {booking.date && (
                  <div>
                    <span className="text-slate-500">Date : </span>
                    <span className="text-slate-300">{booking.date}</span>
                  </div>
                )}
                {booking.time && (
                  <div>
                    <span className="text-slate-500">Heure : </span>
                    <span className="text-slate-300">{booking.time}</span>
                  </div>
                )}
                {booking.meetingType && (
                  <div>
                    <span className="text-slate-500">Type : </span>
                    <span className="text-slate-300">{booking.meetingType}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error message */}
        {status === 'error' && errorMessage && (
          <Card className="mb-4 border-red-800 bg-red-900/30 backdrop-blur">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{errorMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Action Button */}
        <Button
          onClick={isActive ? stopCall : startCall}
          disabled={status === 'requesting_token' || status === 'disconnecting'}
          className={`min-h-[56px] text-lg font-semibold ${
            isActive
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
          size="lg"
        >
          {status === 'requesting_token' || status === 'connecting' ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Connexion en cours...
            </>
          ) : isActive ? (
            <>
              <PhoneOff className="mr-2 h-5 w-5" />
              Raccrocher
            </>
          ) : (
            <>
              <Phone className="mr-2 h-5 w-5" />
              Lancer l&apos;appel avec Sophie
            </>
          )}
        </Button>

        {/* Privacy Notice */}
        <p className="mt-3 text-center text-xs text-slate-500">
          {status === 'idle'
            ? 'Votre microphone sera utilisé pour la conversation vocale. Aucun audio n\u2019est enregistré.'
            : 'Propulsé par Google Gemini. L\u2019audio est traité en temps réel et non conservé.'}
        </p>
      </main>

      {/* Animation keyframes */}
      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            transform: scaleY(1);
          }
          50% {
            transform: scaleY(2.5);
          }
        }
        @keyframes ring-pulse {
          0% {
            opacity: 0.6;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
