
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Modality } from "@google/genai";

// --- Gemini APIの初期化 ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- 定数定義 (Pythonスクリプトから移植) ---
const FREE_TIER_IMAGE_TOKEN_LIMIT = 8000;
const FREE_TIER_VIDEO_TOKEN_LIMIT = 32000;

// FIX: Add 'as const' to enable discriminated union type checking on the 'type' property.
const PARAMETERS = {
  gender: { type: "radio", label: "性別", choices: { "女性": "1girl, female", "男性": "1boy, male", "中性": "androgynous" } },
  age: { type: "slider", label: "年齢", min: 0, max: 150 },
  height: { type: "slider", label: "身長 (cm)", min: 100, max: 200 },
  bodyType: { type: "dropdown", label: "体型", choices: { "選択なし": "", "スリム": "slim body", "アスレチック": "athletic body", "平均": "average body", "ヘビー": "heavy body" } },
  face_features: { type: "checkboxgroup", label: "顔の特徴", choices: { "美形": "beautiful face", "そばかす": "freckles", "涙": "tears", "よだれ": "drooling", "鼻水": "snot" } },
  hairstyle: { type: "dropdown", label: "髪型", choices: { 
    "選択なし": "",
    "ロング": "long hair", "ショート": "short hair", "ツインテール": "twin tails", "ポニーテール": "ponytail", "姫カット": "hime cut", "自然なウェーブ": "natural wave hair", "ドリルツインテール": "twintail drill hair", "アホ毛": "ahoge", "ハーフアップ": "half up hair", "リングレット": "ringlets hair", "お団子": "messy bun", "三つ編み": "braid",
    "スキンヘッド": "skinhead", "ツーブロック": "two-block haircut", "オールバック": "slicked back hair", "七三分け": "side part", "センターパート": "center part hair", "マッシュヘア": "mushroom cut", "ウルフカット": "wolf cut", "ドレッドヘア": "dreadlocks", "アフロ": "afro"
   } },
  hair_color: { type: "color", label: "髪色" },
  eye_color: { type: "color", label: "目の色" },
  outfit: { type: "dropdown", label: "服装", choices: { "選択なし": "", "制服": "school uniform", "ドレス": "dress", "スーツ": "suit", "着物": "kimono" } },
  pose: { type: "dropdown", label: "ポーズ", choices: { "選択なし": "", "正面": "front view", "横顔": "side profile", "座る": "sitting", "寝る": "lying down", "魔法を唱える": "cast a spell", "ダンス": "dancing", "玉座に座る": "sitting on the throne", "飛ぶ": "flying", "振り返る": "looking back at viewer", "立つ": "standing pose", "腰に手を当てる": "hand on own hip", "Vサイン": "v sign" } },
  expression: { type: "dropdown", label: "表情", choices: { "選択なし": "", "笑顔": "smiling", "泣き顔": "crying", "驚き": "surprised", "無表情": "expressionless", "にやりと笑う": "grin", "ウインク": "wink / one eye closed", "狂気の笑顔": "crazy smile", "微笑み": "cheerful smile", "決意の表情": "determined" } },
  background: {
    type: "nested-dropdown",
    label: "背景",
    categories: {
      "選択なし": { "選択なし": "" },
      "室内": {
        "学校": "in school",
        "図書館": "in library",
        "カフェ": "in cafe",
        "寝室": "in bedroom",
        "オフィス": "in office"
      },
      "自然": {
        "森": "in forest",
        "ビーチ": "on beach",
        "山": "in the mountains",
        "川": "by the river",
        "花畑": "in flower field"
      },
      "都市": {
        "街中": "cityscape",
        "路地裏": "alleyway",
        "屋上": "on rooftop",
        "駅": "at train station",
        "夜景": "night cityscape"
      },
      "ファンタジー": {
        "城": "in a castle",
        "遺跡": "in ruins",
        "魔法の森": "in a magical forest",
        "浮遊島": "on a floating island"
      },
      "抽象": {
        "グラデーション": "gradient background",
        "幾何学模様": "geometric pattern background",
        "単色": "simple background, solid color background"
      }
    }
  },
  lighting: { type: "dropdown", label: "ライティング", choices: { "選択なし": "", "柔らかい光": "soft lighting", "劇的な影": "dramatic shadows", "明るい昼光": "bright daylight", "逆光": "sidelighting" } },
  style: { type: "dropdown", label: "画風", choices: { "選択なし": "", "アニメ": "anime style", "写実": "realistic", "水彩": "watercolor", "CGイラスト": "highly detailed CG illustration" } },
  genre: { type: "dropdown", label: "ジャンル", choices: { "選択なし": "", "ファンタジー": "fantasy", "SF": "sci-fi", "日常": "slice of life" } },
  angle: { type: "dropdown", label: "カメラアングル", choices: { "選択なし": "", "バストアップ": "bust-up", "全身": "full body", "ローアングル": "low angle", "俯瞰": "bird's eye view", "見上げる": "looking up", "見下ろす": "looking down", "顔のアップ": "close up", "ポートレート": "portraiture", "上半身": "upper body" } },
  description: { type: "textarea", label: "その他の特徴", placeholder: "その他の特徴をカンマ区切りで入力 (例: joyful atmosphere, chromatic aberration)" },
} as const;
const POSITIVE_BASE_TAGS = ["masterpiece", "best quality", "ultra-detailed", "solo", "best quality:1.2", "colorful composition", "artistic photoshoot", "depth of field", "shine", "lighting", "ray tracing", "perfect face", "lustrous skin", "highly detailed face", "highly detailed eyes", "perfect nose", "perfect hair", "perfect eyes", "beautiful hair", "beautiful face", "extremely detailed face", "beautiful detailed eyes", "beautiful clavicle", "beautiful body", "beautiful chest", "beautiful thigh", "beautiful legs", "beautiful fingers", "lovely", "very detailed background:1.0", "highly detailed background:1.0", "intricate details"];
const NEGATIVE_BASE_TAGS = ["low quality", "bad anatomy", "blurry", "extra limbs", "mutated hands", "worst quality", "lowres", "normal quality", "monochrome", "grayscale", "skin spots", "acnes", "skin blemishes", "age spot", "extra fingers", "fewer fingers", "strange fingers", "bad hands", "disfigured", "bad art", "poorly drawn hands"];
const GENRE_TAGS = { fantasy: ["magic", "floating islands", "mystical aura"], "sci-fi": ["cyberpunk", "futuristic city", "neon lights"], "slice of life": ["school setting", "casual clothes", "sunny day"] };
const STYLE_TAGS = { "anime style": ["anime style", "cel shading", "vibrant colors"], realistic: ["realistic", "photorealistic", "sharp focus"], watercolor: ["watercolor", "soft edges", "pastel tones"], "highly detailed CG illustration": ["highly detailed CG illustration", "artistic photoshoot", "ray tracing"] };
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
const IMAGE_GEN_MODELS = {
  'imagen-4.0-generate-001': 'Imagen 4 (高品質)',
  'gemini-2.5-flash-image-preview': 'Gemini Flash Image (高速プレビュー)'
} as const;
const VIDEO_GEN_MODELS = {
  'veo-2.0-generate-001': { name: 'Veo 2 (標準)', type: 'api', tagColor: 'bg-purple-600' },
  'deevid-ai': { name: 'DeeVid AI', type: 'sim', tagColor: 'bg-sky-600' },
  'nolang': { name: 'NoLang', type: 'sim', tagColor: 'bg-rose-600' },
  'stable-video': { name: 'Stable Video', type: 'sim', tagColor: 'bg-amber-600' }
} as const;
const SPRITE_POSES = ["standing", "walking", "running", "jumping", "attacking pose", "happy expression", "sad expression", "surprised expression"] as const;
const MAX_CHARACTERS_IN_SCENE = 4;
const INTERPOLATION_TYPES = {
  linear: '線形',
  'ease-in': 'イーズイン',
  'ease-out': 'イーズアウト',
  'ease-in-out': 'イーズインアウト',
} as const;
const GEMINI_API_MPM_LIMIT = 60; // Requests per minute
const IMAGE_API_MPM_LIMIT = 10;
const VIDEO_API_MPM_LIMIT = 2;
const IMAGE_API_DPM_LIMIT = 1000; // Requests per day (per project)
const VIDEO_API_DPM_LIMIT = 50; // Requests per day (per project)


// --- 型定義 ---
type AspectRatio = typeof ASPECT_RATIOS[number];
type ImageGenModel = keyof typeof IMAGE_GEN_MODELS;
type VideoGenModel = keyof typeof VIDEO_GEN_MODELS;
type InterpolationType = keyof typeof INTERPOLATION_TYPES;

type CharacterParams = {
  [key in keyof typeof PARAMETERS]?: any;
} & { name: string; imageUrl: string; };


interface Character {
  id: string;
  params: CharacterParams;
  positivePrompt: string;
  negativePrompt: string;
}

type InputMode = 'storyboard' | 'audio';

interface StoryboardItem {
  id: string;
  scene: number;
  time: number;
  story: string;
  scenario: string;
  angle: string;
  notes: string;
}

interface Keyframe {
  id:string;
  time: number; // in seconds
  pose: string;
  expression: string;
  interpolation: InterpolationType;
}

interface KeyframeGroup {
  id: string;
  name: string;
  keyframeRefs: { characterId: string; keyframeId: string; }[];
  color: string;
}

type AnimationTimelineData = Record<string, Keyframe[]>;

interface TimelineState {
    timeline: AnimationTimelineData;
    groups: KeyframeGroup[];
}

interface HistoryItem {
  id: string;
  lyrics: string;
  prompt: string;
  negativePrompt: string;
  animationStyle: string;
  videoDuration: number;
  characterSlotIds: (string | null)[];
  inputType?: InputMode;
  aspectRatio?: AspectRatio;
  timelineState?: TimelineState;
  storyboardData?: StoryboardItem[];
  videoGenModel?: VideoGenModel;
}

interface CustomBackground {
  id: string;
  name: string;
  prompt: string;
  imageUrl: string;
}

interface AnalysisSuggestions {
    tags: string;
    positivePrompt: string;
    negativePrompt: string;
}


const getInitialCharacterParams = (): CharacterParams => ({
    name: '',
    imageUrl: '',
    gender: '女性',
    age: 20,
    height: 165,
    bodyType: '選択なし',
    face_features: ['美形'],
    hairstyle: '選択なし',
    hair_color: '#F9D4A5',
    eye_color: '#8A5A44',
    outfit: '選択なし',
    pose: '選択なし',
    expression: '選択なし',
    background: '選択なし',
    lighting: '選択なし',
    style: '選択なし',
    genre: '選択なし',
    angle: '選択なし',
    description: '',
});


// --- ヘルパー関数 ---
const estimateTokenCount = (text: string): number => {
  // A simple approximation. For Japanese, character count is a reasonable proxy.
  return text.length;
};

const showToast = (message: string, bgColor: string = '#4CAF50') => {
  const toast = document.createElement('div');
  toast.innerText = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.background = bgColor;
  toast.style.color = 'white';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '5px';
  toast.style.zIndex = '9999';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
};

const downloadFile = async (url: string, filename: string, isText: boolean = false) => {
  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    let objectUrlToRevoke: string | null = null;

    if (isText) {
       const blob = new Blob([url], { type: 'text/plain;charset=utf-8' });
       a.href = window.URL.createObjectURL(blob);
       objectUrlToRevoke = a.href;
    } else {
        if (url.startsWith('data:')) {
            // For data URLs, convert to blob to download properly on all browsers, especially for large files.
            const response = await fetch(url);
            const blob = await response.blob();
            a.href = window.URL.createObjectURL(blob);
            objectUrlToRevoke = a.href;
        } else if (url.startsWith('blob:')) {
            a.href = url;
            // We don't revoke blob URLs passed from outside, as the caller is responsible for them.
        } else {
            // For external URLs, use fetch to get a blob.
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const blob = await response.blob();
            a.href = window.URL.createObjectURL(blob);
            objectUrlToRevoke = a.href;
        }
    }
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    if (objectUrlToRevoke) {
        window.URL.revokeObjectURL(objectUrlToRevoke);
    }
  } catch (error) {
    console.error('Download failed:', error);
    alert('ダウンロードに失敗しました。コンソールでエラーを確認してください。');
  }
};


const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`✅ ${label} をコピーしました！`);
    });
};

const getAspectRatioClass = (ratio: AspectRatio) => {
    switch (ratio) {
        case '1:1': return 'aspect-square';
        case '16:9': return 'aspect-video';
        case '9:16': return 'aspect-[9/16]';
        case '4:3': return 'aspect-[4/3]';
        case '3:4': return 'aspect-[3/4]';
        default: return 'aspect-square';
    }
};

const getResolutionForAspectRatio = (ratio: AspectRatio, baseSize: number = 1024): { width: number, height: number } => {
    switch (ratio) {
        case '16:9': return { width: baseSize, height: Math.round(baseSize * 9 / 16) };
        case '9:16': return { width: Math.round(baseSize * 9 / 16), height: baseSize };
        case '4:3': return { width: baseSize, height: Math.round(baseSize * 3 / 4) };
        case '3:4': return { width: Math.round(baseSize * 3 / 4), height: baseSize };
        case '1:1':
        default:
            return { width: baseSize, height: baseSize };
    }
};

const removePoseFromPrompt = (prompt: string): string => {
    const allPoseTags = [...Object.values(PARAMETERS.pose.choices), ...Object.values(PARAMETERS.expression.choices)];
    let cleanedPrompt = prompt;
    for (const tag of allPoseTags) {
        if (tag) {
            const escapedTag = tag.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
            const regex = new RegExp(`\\b${escapedTag}\\b,?\\s*`, 'gi');
            cleanedPrompt = cleanedPrompt.replace(regex, '');
        }
    }
    return cleanedPrompt.replace(/, ,/g, ',').replace(/,$/, '').trim();
}

const easingFunctions: Record<InterpolationType, (t: number) => number> = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => t * (2 - t),
  'ease-in-out': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};

const generateRandomColor = () => {
  const colors = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
  return colors[Math.floor(Math.random() * colors.length)];
};

const extractFramesFromVideo = (videoUrl: string, frameCount: number): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        const frames: string[] = [];

        video.onloadedmetadata = () => {
            if (video.duration === Infinity) {
                video.currentTime = 1e101; // seek to end to get duration for streams
                video.ontimeupdate = () => {
                    video.ontimeupdate = null;
                    video.currentTime = 0;
                    startFrameExtraction();
                };
            } else {
                startFrameExtraction();
            }
        };
        
        const startFrameExtraction = () => {
            const duration = video.duration;
            if (duration <= 0) {
                 return reject('Video duration is invalid.');
            }
            
            const interval = duration / frameCount;
            let currentTime = 0;
            let processedFrames = 0;
            
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');
            
            const captureFrame = () => {
                if (processedFrames >= frameCount) {
                    if(frames.length > 0) resolve(frames);
                    else reject('No frames were extracted.');
                    return;
                }
                
                video.currentTime = currentTime;
            };

            video.onseeked = () => {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg'));
                processedFrames++;
                currentTime += interval;
                
                if (currentTime > duration) {
                    currentTime = duration;
                }
                captureFrame();
            };
            
            captureFrame();
        };

        video.onerror = (e) => {
            reject(`Video error: ${e?.toString()}`);
        };
        
        video.src = videoUrl;
    });
};

const App = () => {
  // --- メインタブState ---
  const [mainTab, setMainTab] = useState<'animator' | 'character' | 'framer' | 'settings'>('animator');
  const [useGeminiApi, setUseGeminiApi] = useState<boolean>(true);
  const [apiNotification, setApiNotification] = useState<string | null>(null);
  const [imageGenModel, setImageGenModel] = useState<ImageGenModel>('imagen-4.0-generate-001');
  const [videoGenModel, setVideoGenModel] = useState<VideoGenModel>('veo-2.0-generate-001');
  const [apiTimestamps, setApiTimestamps] = useState<number[]>([]);
  const [apiRemaining, setApiRemaining] = useState<number>(GEMINI_API_MPM_LIMIT);
  const [imageApiTimestamps, setImageApiTimestamps] = useState<number[]>([]);
  const [imageApiRemaining, setImageApiRemaining] = useState<number>(IMAGE_API_MPM_LIMIT);
  const [videoApiTimestamps, setVideoApiTimestamps] = useState<number[]>([]);
  const [videoApiRemaining, setVideoApiRemaining] = useState<number>(VIDEO_API_MPM_LIMIT);
  const [dailyImageUsage, setDailyImageUsage] = useState<number>(0);
  const [dailyVideoUsage, setDailyVideoUsage] = useState<number>(0);


  // --- App Settings ---
  const [isPromptOptimizationEnabled, setIsPromptOptimizationEnabled] = useState<boolean>(true);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState<boolean>(true);
  const [isQuotaCostVisible, setIsQuotaCostVisible] = useState<boolean>(true);


  // --- リリック・アニメーター States ---
  const [lyrics, setLyrics] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [animationStyle, setAnimationStyle] = useState('auto');
  const [videoDuration, setVideoDuration] = useState(8);
  const [videoAspectRatio, setVideoAspectRatio] = useState<AspectRatio>('1:1');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<InputMode>('storyboard');
  
  // Character states
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterSlots, setCharacterSlots] = useState<Character[]>([]);
  const [isCreatingChar, setIsCreatingChar] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [charParams, setCharParams] = useState<CharacterParams>(getInitialCharacterParams());
  const [charAspectRatio, setCharAspectRatio] = useState<AspectRatio>('1:1');
  const [generatedPositivePrompt, setGeneratedPositivePrompt] = useState('');
  const [generatedNegativePrompt, setGeneratedNegativePrompt] = useState('');
  const [analysisSuggestions, setAnalysisSuggestions] = useState<AnalysisSuggestions | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [selectedBgCategory, setSelectedBgCategory] = useState<string>('選択なし');

  // Custom Background states
  const [customBackgrounds, setCustomBackgrounds] = useState<CustomBackground[]>([]);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [bgPrompt, setBgPrompt] = useState('');
  const [bgAspectRatio, setBgAspectRatio] = useState<AspectRatio>('1:1');
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [generatedBgUrl, setGeneratedBgUrl] = useState<string | null>(null);

  // Sprite Sheet States
  const [isSpriteSheetModalOpen, setIsSpriteSheetModalOpen] = useState(false);
  const [generatingSpriteSheetFor, setGeneratingSpriteSheetFor] = useState<Character | null>(null);
  const [isGeneratingSpriteSheet, setIsGeneratingSpriteSheet] = useState(false);
  const [generatedSpriteSheetUrl, setGeneratedSpriteSheetUrl] = useState<string | null>(null);
  const [spriteGenerationProgress, setSpriteGenerationProgress] = useState<{ current: number; total: number; currentPose: string } | null>(null);

  // Storyboard State
  const [storyboardData, setStoryboardData] = useState<StoryboardItem[]>([
    { id: new Date().toISOString(), scene: 1, time: 0, story: '', scenario: '', angle: '選択なし', notes: '' }
  ]);

  // --- Animation Timeline & Undo/Redo States ---
  const [timelineHistory, setTimelineHistory] = useState<TimelineState[]>([{ timeline: {}, groups: [] }]);
  const [timelineHistoryIndex, setTimelineHistoryIndex] = useState(0);
  const currentTimelineState = timelineHistory[timelineHistoryIndex];
  const { timeline: animationTimeline, groups: keyframeGroups } = currentTimelineState;
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const panningRef = useRef<{ active: boolean; startX: number; startScrollLeft: number }>({ active: false, startX: 0, startScrollLeft: 0 });
  const [draggingKeyframe, setDraggingKeyframe] = useState<{ characterId: string; keyframeId: string; groupId?: string, initialTimes?: Record<string, number>, startX: number } | null>(null);
  const [selectedKeyframes, setSelectedKeyframes] = useState<Record<string, string[]>>({}); // { charId: [kfId1, kfId2] }
  const [isIntermediateModalOpen, setIsIntermediateModalOpen] = useState(false);
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ keyframes: (Keyframe & { characterId: string })[] } | null>(null);

  const updateTimelineState = (updater: (prevState: TimelineState) => TimelineState) => {
      const currentState = timelineHistory[timelineHistoryIndex];
      const newState = updater(currentState);

      if (JSON.stringify(newState) === JSON.stringify(currentState)) {
          return;
      }

      const newHistory = timelineHistory.slice(0, timelineHistoryIndex + 1);
      newHistory.push(newState);
      setTimelineHistory(newHistory);
      setTimelineHistoryIndex(newHistory.length - 1);
  };
    
  const [editingKeyframeInfo, setEditingKeyframeInfo] = useState<{
      character: Character;
      keyframe?: Keyframe;
  } | null>(null);
  const [copiedKeyframe, setCopiedKeyframe] = useState<{ pose: string; expression: string; interpolation: InterpolationType; } | null>(null);

  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const characterFileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);


  // --- 中間フレーム生成 States ---
  const [framerMode, setFramerMode] = useState<'image' | 'video' | 'animation'>('image');
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [endImageMode, setEndImageMode] = useState<'upload' | 'generate'>('upload');
  const [endImagePrompt, setEndImagePrompt] = useState('');
  const [isGeneratingEndImage, setIsGeneratingEndImage] = useState(false);
  const [startImage, setStartImage] = useState<string | null>(null);
  const [endImage, setEndImage] = useState<string | null>(null);
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [isGeneratingFrames, setIsGeneratingFrames] = useState(false);
  const [frameCount, setFrameCount] = useState(8);
  const [framerAspectRatio, setFramerAspectRatio] = useState<AspectRatio>('1:1');
  const [animationPrompt, setAnimationPrompt] = useState('');
    
  // Framer AI Toolkit States
  const [inspectorImage, setInspectorImage] = useState<string | null>(null);
  const [inspectorPrompt, setInspectorPrompt] = useState('');
  const [isInspectingImage, setIsInspectingImage] = useState(false);
  const [painterPrompt, setPainterPrompt] = useState('');
  const [painterGeneratedImage, setPainterGeneratedImage] = useState<string | null>(null);
  const [isPaintingImage, setIsPaintingImage] = useState(false);
  const [painterAspectRatio, setPainterAspectRatio] = useState<AspectRatio>('1:1');
  const [painterModel, setPainterModel] = useState<ImageGenModel>('imagen-4.0-generate-001');

  // --- API Usage Calculation ---
  const calculateApiRemaining = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentTimestamps = apiTimestamps.filter(ts => ts > oneMinuteAgo);
    if (recentTimestamps.length !== apiTimestamps.length) {
      setApiTimestamps(recentTimestamps); // Clean up old timestamps
    }
    return GEMINI_API_MPM_LIMIT - recentTimestamps.length;
  }, [apiTimestamps]);

  const calculateImageApiRemaining = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentTimestamps = imageApiTimestamps.filter(ts => ts > oneMinuteAgo);
    if (recentTimestamps.length !== imageApiTimestamps.length) {
      setImageApiTimestamps(recentTimestamps);
    }
    return IMAGE_API_MPM_LIMIT - recentTimestamps.length;
  }, [imageApiTimestamps]);

  const calculateVideoApiRemaining = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentTimestamps = videoApiTimestamps.filter(ts => ts > oneMinuteAgo);
    if (recentTimestamps.length !== videoApiTimestamps.length) {
      setVideoApiTimestamps(recentTimestamps);
    }
    return VIDEO_API_MPM_LIMIT - recentTimestamps.length;
  }, [videoApiTimestamps]);

  const recordApiCall = () => {
    const now = Date.now();
    setApiTimestamps(prev => [...prev.filter(ts => ts > now - 60000), now]);
  };
  const recordImageApiCall = () => {
    const now = Date.now();
    setImageApiTimestamps(prev => [...prev.filter(ts => ts > now - 60000), now]);
    setDailyImageUsage(prev => prev + 1);
  };
  const recordVideoApiCall = () => {
    const now = Date.now();
    setVideoApiTimestamps(prev => [...prev.filter(ts => ts > now - 60000), now]);
    setDailyVideoUsage(prev => prev + 1);
  };

  // --- useEffectフック ---
  useEffect(() => {
    try {
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;

      const storedTimestamps = localStorage.getItem('geminiApiTimestamps');
      if (storedTimestamps) {
        const parsed = JSON.parse(storedTimestamps);
        if (Array.isArray(parsed)) setApiTimestamps(parsed.filter(ts => ts > oneMinuteAgo));
      }

      const storedImageTimestamps = localStorage.getItem('geminiImageApiTimestamps');
      if (storedImageTimestamps) {
        const parsed = JSON.parse(storedImageTimestamps);
        if (Array.isArray(parsed)) setImageApiTimestamps(parsed.filter(ts => ts > oneMinuteAgo));
      }

      const storedVideoTimestamps = localStorage.getItem('geminiVideoApiTimestamps');
      if (storedVideoTimestamps) {
        const parsed = JSON.parse(storedVideoTimestamps);
        if (Array.isArray(parsed)) setVideoApiTimestamps(parsed.filter(ts => ts > oneMinuteAgo));
      }

      const storedHistory = localStorage.getItem('lyricAnimatorHistory');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) setHistory(parsedHistory as HistoryItem[]);
      }

      const storedCharactersStr = localStorage.getItem('lyricAnimatorCharacters');
      let loadedCharacters: Character[] = [];
      if (storedCharactersStr) {
          const parsedChars = JSON.parse(storedCharactersStr);
          if (Array.isArray(parsedChars)) {
              loadedCharacters = parsedChars as Character[];
              setCharacters(loadedCharacters);
          }
      }
      
      const storedPromptOptimization = localStorage.getItem('isPromptOptimizationEnabled');
      if (storedPromptOptimization) {
        setIsPromptOptimizationEnabled(JSON.parse(storedPromptOptimization));
      }
      const storedAutoSave = localStorage.getItem('isAutoSaveEnabled');
      if (storedAutoSave) {
        setIsAutoSaveEnabled(JSON.parse(storedAutoSave));
      }
       const storedQuotaCostVisible = localStorage.getItem('isQuotaCostVisible');
      if (storedQuotaCostVisible) {
        setIsQuotaCostVisible(JSON.parse(storedQuotaCostVisible));
      }


      const storedBackgrounds = localStorage.getItem('lyricAnimatorBackgrounds');
      if (storedBackgrounds) {
        const parsedBackgrounds = JSON.parse(storedBackgrounds);
        if (Array.isArray(parsedBackgrounds)) setCustomBackgrounds(parsedBackgrounds as CustomBackground[]);
      }
      
      const today = new Date().toISOString().split('T')[0];
      const storedUsageStr = localStorage.getItem('geminiDailyUsage');
      if (storedUsageStr) {
        const storedUsage = JSON.parse(storedUsageStr);
        if (storedUsage.date === today) {
          setDailyImageUsage(storedUsage.image || 0);
          setDailyVideoUsage(storedUsage.video || 0);
        } else {
          // Date has changed, reset usage
          localStorage.setItem('geminiDailyUsage', JSON.stringify({ date: today, image: 0, video: 0 }));
        }
      } else {
        localStorage.setItem('geminiDailyUsage', JSON.stringify({ date: today, image: 0, video: 0 }));
      }


      const autoSavedSession = localStorage.getItem('lyricAnimatorAutoSave');
      if (autoSavedSession) {
          const sessionData = JSON.parse(autoSavedSession);
          setLyrics(sessionData.lyrics || '');
          setPrompt(sessionData.prompt || '');
          setNegativePrompt(sessionData.negativePrompt || '');
          setAnimationStyle(sessionData.animationStyle || 'auto');
          setVideoDuration(sessionData.videoDuration || 8);
          setVideoAspectRatio(sessionData.videoAspectRatio || '1:1');
          setVideoGenModel(sessionData.videoGenModel || 'veo-2.0-generate-001');
          setActiveTab(sessionData.activeTab || 'storyboard');
          
          if (sessionData.characterSlotIds && Array.isArray(sessionData.characterSlotIds) && loadedCharacters.length > 0) {
              const restoredSlots = (sessionData.characterSlotIds as (string|null)[])
                  .map((id: string | null) => loadedCharacters.find((c: Character) => c.id === id))
                  .filter((c: Character | undefined): c is Character => !!c);
              setCharacterSlots(restoredSlots);
          }
          
          if (sessionData.timelineState) {
              setTimelineHistory([sessionData.timelineState as TimelineState]);
              setTimelineHistoryIndex(0);
          }

          if (sessionData.storyboardData) {
            setStoryboardData(sessionData.storyboardData);
          }
          
          showToast('📝 前回のセッションを復元しました', '#1E88E5');
      }

    } catch (error) {
      console.error("Failed to parse from localStorage", error);
    }
  }, []);
  
  useEffect(() => {
    if (apiNotification) {
      const timer = setTimeout(() => setApiNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [apiNotification]);
  
  useEffect(() => {
    setApiRemaining(calculateApiRemaining());
    setImageApiRemaining(calculateImageApiRemaining());
    setVideoApiRemaining(calculateVideoApiRemaining());
    localStorage.setItem('geminiApiTimestamps', JSON.stringify(apiTimestamps));
    localStorage.setItem('geminiImageApiTimestamps', JSON.stringify(imageApiTimestamps));
    localStorage.setItem('geminiVideoApiTimestamps', JSON.stringify(videoApiTimestamps));

    const interval = setInterval(() => {
      setApiRemaining(calculateApiRemaining());
      setImageApiRemaining(calculateImageApiRemaining());
      setVideoApiRemaining(calculateVideoApiRemaining());
    }, 5000);

    return () => clearInterval(interval);
  }, [apiTimestamps, imageApiTimestamps, videoApiTimestamps, calculateApiRemaining, calculateImageApiRemaining, calculateVideoApiRemaining]);


  useEffect(() => {
    try {
      localStorage.setItem('lyricAnimatorHistory', JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save history to localStorage", error);
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem('lyricAnimatorCharacters', JSON.stringify(characters));
    } catch (error) {
      console.error("Failed to save characters to localStorage", error);
    }
  }, [characters]);

  useEffect(() => {
    try {
        localStorage.setItem('lyricAnimatorBackgrounds', JSON.stringify(customBackgrounds));
    } catch (error) {
        console.error("Failed to save custom backgrounds to localStorage", error);
    }
  }, [customBackgrounds]);

  useEffect(() => {
    localStorage.setItem('isPromptOptimizationEnabled', JSON.stringify(isPromptOptimizationEnabled));
  }, [isPromptOptimizationEnabled]);

  useEffect(() => {
    localStorage.setItem('isAutoSaveEnabled', JSON.stringify(isAutoSaveEnabled));
  }, [isAutoSaveEnabled]);

  useEffect(() => {
    localStorage.setItem('isQuotaCostVisible', JSON.stringify(isQuotaCostVisible));
  }, [isQuotaCostVisible]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const usageData = {
      date: today,
      image: dailyImageUsage,
      video: dailyVideoUsage,
    };
    localStorage.setItem('geminiDailyUsage', JSON.stringify(usageData));
  }, [dailyImageUsage, dailyVideoUsage]);


  // Auto-save session effect
  useEffect(() => {
    if (!isAutoSaveEnabled) {
      return; // Do nothing if auto-save is disabled.
    }
    
    const intervalId = setInterval(() => {
        const sessionToSave = {
            lyrics,
            prompt,
            negativePrompt,
            animationStyle,
            videoDuration,
            videoAspectRatio,
            videoGenModel,
            activeTab,
            characterSlotIds: characterSlots.map(c => c.id),
            timelineState: currentTimelineState,
            storyboardData,
        };
        localStorage.setItem('lyricAnimatorAutoSave', JSON.stringify(sessionToSave));
        showToast('💾 作業内容を自動保存しました', '#1E88E5');
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);

  }, [
      isAutoSaveEnabled,
      lyrics, 
      prompt, 
      negativePrompt, 
      animationStyle, 
      videoDuration, 
      videoAspectRatio, 
      videoGenModel,
      activeTab,
      characterSlots,
      timelineHistory, 
      timelineHistoryIndex,
      storyboardData
  ]);

  const selectedKeyframesCount = Object.values(selectedKeyframes).flat().length;
  const getGroupForKeyframe = (characterId: string, keyframeId: string) => {
      return keyframeGroups.find(g => g.keyframeRefs.some(ref => ref.characterId === characterId && ref.keyframeId === keyframeId));
  };
  const isAnySelectedInGroup = Object.entries(selectedKeyframes).some(([charId, kfIds]) =>
    Array.isArray(kfIds) && kfIds.some(kfId => !!getGroupForKeyframe(charId, kfId))
  );

  // Keyboard shortcuts for timeline
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl instanceof HTMLInputElement ||
                         activeEl instanceof HTMLTextAreaElement ||
                         activeEl instanceof HTMLSelectElement;
        
        if (isTyping || mainTab !== 'animator' || editingKeyframeInfo || isIntermediateModalOpen) {
            return;
        }

        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const isCtrl = isMac ? event.metaKey : event.ctrlKey;

        let handled = false;

        if (isCtrl) {
            switch (event.key.toLowerCase()) {
                case 'c': 
                    if (selectedKeyframesCount > 0) {
                        handleCopy();
                        handled = true;
                    }
                    break;
                case 'v': 
                    if (clipboard) {
                        handlePaste();
                        handled = true;
                    }
                    break;
                case 'g': 
                    if (event.shiftKey) {
                        if (isAnySelectedInGroup) {
                            handleUngroup(); 
                            handled = true;
                        }
                    } else {
                        if (selectedKeyframesCount >= 2) {
                            handleGroup();
                            handled = true;
                        }
                    }
                    break;
                case 'z':
                    if (event.shiftKey) {
                        if (timelineHistoryIndex < timelineHistory.length - 1) {
                            handleTimelineRedo(); 
                            handled = true;
                        }
                    } else {
                        if (timelineHistoryIndex > 0) {
                            handleTimelineUndo();
                            handled = true;
                        }
                    }
                    break;
                case 'y':
                    if (!isMac) { 
                         if (timelineHistoryIndex < timelineHistory.length - 1) {
                            handleTimelineRedo(); 
                            handled = true; 
                        }
                    }
                    break;
                case '=':
                case '+':
                    if (zoomLevel < 8) {
                        zoomWithButtons('in'); 
                        handled = true;
                    }
                    break;
                case '-':
                    if (zoomLevel > 0.25) {
                        zoomWithButtons('out'); 
                        handled = true; 
                    }
                    break;
            }
        } else {
            switch (event.key) {
                case 'Delete':
                case 'Backspace':
                    if (selectedKeyframesCount > 0) {
                        handleDeleteSelectedKeyframes(); 
                        handled = true; 
                    }
                    break;
                case 'ArrowLeft':
                    const panAmountL = event.shiftKey ? 100 : 20;
                    setTimelineScrollLeft(prev => Math.max(0, prev - panAmountL));
                    handled = true;
                    break;
                case 'ArrowRight':
                    const panAmountR = event.shiftKey ? 100 : 20;
                    const timelineRect = timelineContainerRef.current?.getBoundingClientRect();
                    if (timelineRect) {
                        const maxScroll = Math.max(0, (timelineRect.width * zoomLevel) - timelineRect.width);
                        setTimelineScrollLeft(prev => Math.min(maxScroll, prev + panAmountR));
                    }
                    handled = true;
                    break;
            }
        }

        if (handled) {
            event.preventDefault();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
      mainTab, 
      editingKeyframeInfo, 
      isIntermediateModalOpen, 
      selectedKeyframes,
      clipboard,
      animationTimeline,
      keyframeGroups,
      timelineHistory,
      timelineHistoryIndex,
      zoomLevel,
      timelineScrollLeft,
      videoDuration,
      characterSlots,
      isAnySelectedInGroup,
      selectedKeyframesCount,
  ]);


  const handleApiError = (error: any) => {
    console.error("Gemini API Error:", error);

    // Combine multiple potential sources of the error message to create a comprehensive string for checking.
    let errorContentForCheck = '';
    if (error) {
        // Start with the message property, which is common.
        if (typeof error.message === 'string') {
            errorContentForCheck = error.message;
        }
        
        // Add the stringified version of the whole object, as details can be in other properties.
        // This handles plain objects well. For Error objects, it might return '{}', but we already have the message.
        try {
            const stringified = JSON.stringify(error);
            if (stringified !== '{}') {
                errorContentForCheck += ` ${stringified}`;
            }
        } catch (e) {
            // If stringify fails, fallback to toString()
            errorContentForCheck += ` ${String(error)}`;
        }
    }

    const lowerCaseCheck = errorContentForCheck.toLowerCase();
    const isQuotaError = 
        lowerCaseCheck.includes('429') || 
        lowerCaseCheck.includes('quota') || 
        lowerCaseCheck.includes('resource_exhausted') || 
        lowerCaseCheck.includes('割り当て'); // Japanese for "quota"

    if (isQuotaError) {
        if (useGeminiApi) { 
            setUseGeminiApi(false);
            setApiNotification("APIの利用上限に達したため、シミュレーションモードに切り替えました。");
        }
    } else {
        const errorMessage = (error && error.message) ? error.message : JSON.stringify(error);
        alert(`APIの呼び出し中に予期せぬエラーが発生しました:\n${errorMessage}\n\n詳細はコンソールを確認してください。`);
    }
  };
  
  const checkTokenLimit = (prompt: string, limit: number): boolean => {
    if (!isPromptOptimizationEnabled) {
        return true; // Skip check
    }
    const tokenCount = estimateTokenCount(prompt);
    if (tokenCount > limit) {
        alert(`トークン数が無料枠の上限を超えています。\n\n送信トークン数: ${tokenCount}\n無料枠トークン数: ${limit}\n\nプロンプトを短くするか、最適化をOFFにしてください。`);
        return false;
    }
    return true;
  };

  const generateImageWithAi = async (prompt: string, model: ImageGenModel, aspectRatio: AspectRatio, baseSize: number = 1024): Promise<string> => {
    if (!checkTokenLimit(prompt, FREE_TIER_IMAGE_TOKEN_LIMIT)) {
        throw new Error("Token limit exceeded");
    }

    if (model === 'imagen-4.0-generate-001') {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        },
      });
      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    } else { // 'gemini-2.5-flash-image-preview'
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });
      const imagePartResponse = response.candidates[0].content.parts.find(part => part.inlineData);
      if (imagePartResponse && imagePartResponse.inlineData) {
        const base64ImageBytes = imagePartResponse.inlineData.data;
        const mimeType = imagePartResponse.inlineData.mimeType;
        return `data:${mimeType};base64,${base64ImageBytes}`;
      } else {
        throw new Error('AIから画像が返されませんでした。(gemini-2.5-flash-image-preview)');
      }
    }
  };


  // --- プロンプト生成ロジック ---
  const generatePrompts = useCallback(() => {
    const promptParts: string[] = [];
    
    Object.entries(charParams).forEach(([key, value]) => {
      if (!value || key === 'name' || key === 'description' || key === 'imageUrl' || key === 'background') return;

      const paramDef = PARAMETERS[key as keyof typeof PARAMETERS];
      if (!paramDef) return;

      if (paramDef.type === 'color') {
        if (key === 'hair_color') promptParts.push(`${value} hair`);
        else if (key === 'eye_color') promptParts.push(`${value} eyes`);
      } else if (paramDef.type === 'slider') {
        if (key === 'age' && (value as number) > 0) {
          promptParts.push(`${value} years old`);
        } else if (key === 'height') {
          promptParts.push(`${value}cm height`);
        }
      } else if ('choices' in paramDef) {
        if (Array.isArray(value)) { // checkboxgroup
          value.forEach(v => {
            const choiceValue = (paramDef.choices as Record<string, string>)[v];
            if (choiceValue) {
              promptParts.push(choiceValue);
            }
          });
        } else { // radio, dropdown
          const choiceValue = (paramDef.choices as Record<string, string>)[value as string];
          if (choiceValue) {
            promptParts.push(choiceValue);
          }
        }
      }
    });
    
    const backgroundValue = charParams.background;
    if (backgroundValue && backgroundValue !== '選択なし') {
        const customBg = customBackgrounds.find(bg => bg.name === backgroundValue);
        if (customBg) {
            promptParts.push(customBg.prompt);
        } else {
            let choiceValue = '';
            for (const category of Object.values(PARAMETERS.background.categories)) {
                const foundValue = (category as Record<string, string>)[backgroundValue];
                if (foundValue !== undefined) {
                    choiceValue = foundValue;
                    break;
                }
            }
            if (choiceValue) {
                promptParts.push(choiceValue);
            }
        }
    }

    if (charParams.description) {
        promptParts.push(...charParams.description.split(',').map(s => s.trim()).filter(Boolean));
    }
    
    const styleKey = charParams.style;
    const genreKey = charParams.genre;
    const styleTags = STYLE_TAGS[styleKey as keyof typeof STYLE_TAGS] || [];
    const genreTags = GENRE_TAGS[genreKey as keyof typeof GENRE_TAGS] || [];

    const finalPositive = [...POSITIVE_BASE_TAGS, ...styleTags, ...genreTags, ...promptParts].filter(Boolean).join(', ');
    setGeneratedPositivePrompt(finalPositive);
    setGeneratedNegativePrompt(NEGATIVE_BASE_TAGS.join(', '));
  }, [charParams, customBackgrounds]);

  useEffect(() => {
    generatePrompts();
  }, [generatePrompts]);

  // --- 画像解析ロジック ---
  const analyzeImage = async (base64ImageData: string) => {
    if (useGeminiApi) {
        recordApiCall();
    } else {
        setIsAnalyzingImage(true);
        setTimeout(() => {
            setAnalysisSuggestions({
                tags: "シミュレーションモード: 1girl, blonde hair, blue eyes, smiling",
                positivePrompt: "シミュレーションモード: masterpiece, best quality, 1girl, blonde hair, blue eyes, smiling, outdoor, sunny",
                negativePrompt: "シミュレーションモード: low quality, bad anatomy"
            });
            setIsAnalyzingImage(false);
        }, 1500);
        return;
    }

    setIsAnalyzingImage(true);
    setAnalysisSuggestions(null);
    try {
        const base64Data = base64ImageData.split(',')[1];
        const imagePart = {
            inlineData: {
                mimeType: 'image/png',
                data: base64Data,
            },
        };
        const textPart = {
            text: `
              このキャラクター画像を分析してください。
              以下の構造を持つJSONオブジェクトを返してください:
              1. "tags": キャラクターの特徴を詳細に記述した、カンマ区切りのタグ文字列。 (例: "1girl, long blonde hair, blue eyes, wearing a red dress, smiling")
              2. "positivePrompt": このキャラクターを再生成するための、推奨されるポジティブプロンプト。画風や品質に関するタグも含めてください。
              3. "negativePrompt": 生成時に避けるべきことに関する、推奨されるネガティブプロンプト。
            `,
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tags: { type: Type.STRING },
                        positivePrompt: { type: Type.STRING },
                        negativePrompt: { type: Type.STRING },
                    },
                    required: ["tags", "positivePrompt", "negativePrompt"],
                },
            },
        });

        let jsonStr = response.text.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
        }
        const parsedResponse = JSON.parse(jsonStr);
        setAnalysisSuggestions(parsedResponse);
    } catch (error) {
        handleApiError(error);
        setAnalysisSuggestions({ tags: "解析エラーが発生しました。", positivePrompt: "解析エラーが発生しました。", negativePrompt: "解析エラーが発生しました。" });
    } finally {
        setIsAnalyzingImage(false);
    }
  };

  // --- キャラクター管理ハンドラ ---
  const handleCharParamChange = (key: string, value: any) => {
    setCharParams(prev => ({ ...prev, [key]: value }));
  };

  const handleCharImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        setAnalysisSuggestions(null);
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            handleCharParamChange('imageUrl', result);
            if (file.type === 'image/png') {
                analyzeImage(result);
            }
        };
        reader.readAsDataURL(file);
    } else {
        alert('画像ファイルを選択してください。');
    }
    e.target.value = ''; // Reset input
  };

  const handleSelectCharacterForEditing = (char: Character) => {
    setEditingCharacter(char);
    setCharParams(char.params);
    setAnalysisSuggestions(null);

    const bgValue = char.params.background;
    if (bgValue && bgValue !== '選択なし') {
        let foundCategory = '';
        // Check predefined categories
        for (const [categoryName, choices] of Object.entries(PARAMETERS.background.categories)) {
            if (Object.keys(choices).includes(bgValue)) {
                foundCategory = categoryName;
                break;
            }
        }
        // Check custom backgrounds
        if (!foundCategory && customBackgrounds.some(bg => bg.name === bgValue)) {
            foundCategory = 'カスタム';
        }
        setSelectedBgCategory(foundCategory || '選択なし');
    } else {
        setSelectedBgCategory('選択なし');
    }
  };
  
  const handleCancelEditing = () => {
      setEditingCharacter(null);
      setCharParams(getInitialCharacterParams());
      setAnalysisSuggestions(null);
      setSelectedBgCategory('選択なし');
  };

  const handleSaveCharacter = async () => {
    if (!charParams.name) {
      alert('キャラクター名を入力してください。');
      return;
    }
    if (!editingCharacter && characters.length >= 10) {
      alert('キャラクターは10人まで作成できます。');
      return;
    }
    setIsCreatingChar(true);

    try {
      let finalImageUrl = charParams.imageUrl;

      if (!finalImageUrl) {
          if (useGeminiApi) {
              recordImageApiCall();
              finalImageUrl = await generateImageWithAi(generatedPositivePrompt, imageGenModel, charAspectRatio);
          } else {
              // Simulation mode
              const { width, height } = getResolutionForAspectRatio(charAspectRatio);
              finalImageUrl = `https://picsum.photos/seed/${encodeURIComponent(generatedPositivePrompt)}/${width}/${height}?t=${Date.now()}`;
              await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
          }
      }

      const finalCharParams = { ...charParams, imageUrl: finalImageUrl };
      
      const characterData: Omit<Character, 'id'> = {
        params: finalCharParams,
        positivePrompt: generatedPositivePrompt,
        negativePrompt: generatedNegativePrompt,
      };

      if (editingCharacter) {
        setCharacters(prev => prev.map(c => c.id === editingCharacter.id ? { ...c, ...characterData } : c));
      } else {
        const newCharacter: Character = { ...characterData, id: new Date().toISOString() };
        setCharacters(prev => [...prev, newCharacter]);
      }
      handleCancelEditing();

    } catch (error) {
      if ((error as Error).message !== "Token limit exceeded") {
        handleApiError(error);
      }
    } finally {
      setIsCreatingChar(false);
    }
  };

  const handleDeleteCharacter = (id: string) => {
    if (editingCharacter?.id === id) {
        handleCancelEditing();
    }
    setCharacters(prev => prev.filter(char => char.id !== id));
    setCharacterSlots(prev => prev.filter(char => char.id !== id));
  };

  const handleSaveCharactersToFile = () => {
    if (characters.length === 0) {
      alert('保存するキャラクターがいません。');
      return;
    }
    const content = JSON.stringify(characters, null, 2);
    downloadFile(content, 'characters.json', true);
  };

  const handleLoadCharactersFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const loadedData = JSON.parse(content);
            
            if (Array.isArray(loadedData)) {
              setCharacters(prev => [...prev, ...loadedData as Character[]].slice(0, 10));
              alert(`${(loadedData as Character[]).length}人のキャラクターを読み込みました。`);
            } else {
              throw new Error("Loaded data is not an array");
            }
        } catch (error) {
            alert('ファイルの読み込みに失敗しました。正しいJSONファイルか確認してください。')
            console.error(error);
        }
      };
      reader.readAsText(file);
    } else {
        alert('JSON形式のキャラクターファイルをアップロードしてください。');
    }
     if (characterFileInputRef.current) characterFileInputRef.current.value = "";
  };


  // --- 背景生成ハンドラ ---
  const handleGenerateBackground = async () => {
    if (!bgPrompt) {
      alert('背景の説明を入力してください。');
      return;
    }
    setIsGeneratingBg(true);
    setGeneratedBgUrl(null);

    try {
        const fullPrompt = `masterpiece, best quality, ultra-detailed, beautiful scenery, ${bgPrompt}`;
        if (useGeminiApi) {
            recordImageApiCall();
            const imageUrl = await generateImageWithAi(fullPrompt, imageGenModel, bgAspectRatio);
            setGeneratedBgUrl(imageUrl);
        } else {
          // Simulation mode
          const {width, height} = getResolutionForAspectRatio(bgAspectRatio);
          const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(fullPrompt)}/${width}/${height}?t=${Date.now()}`;
          await new Promise(resolve => setTimeout(resolve, 500));
          setGeneratedBgUrl(imageUrl);
        }
    } catch (error) {
      if ((error as Error).message !== "Token limit exceeded") {
        handleApiError(error);
      }
    } finally {
      setIsGeneratingBg(false);
    }
  };

  const handleUseGeneratedBackground = () => {
    if (!generatedBgUrl) return;

    const newBg: CustomBackground = {
      id: new Date().toISOString(),
      name: `カスタム ${customBackgrounds.length + 1}`,
      prompt: bgPrompt,
      imageUrl: generatedBgUrl,
    };

    setCustomBackgrounds(prev => [...prev, newBg]);
    handleCharParamChange('background', newBg.name);
    setSelectedBgCategory('カスタム');

    setIsBgModalOpen(false);
    setBgPrompt('');
    setGeneratedBgUrl(null);
  };

    // --- スプライトシート生成ハンドラ ---
  const handleOpenSpriteSheetModal = (character: Character) => {
    setGeneratingSpriteSheetFor(character);
    setIsSpriteSheetModalOpen(true);
    handleGenerateSpriteSheet(character);
  };

  const handleCloseSpriteSheetModal = () => {
    setIsSpriteSheetModalOpen(false);
    setGeneratingSpriteSheetFor(null);
    setIsGeneratingSpriteSheet(false);
    setGeneratedSpriteSheetUrl(null);
    setSpriteGenerationProgress(null);
  };

  const handleGenerateSpriteSheet = async (character: Character) => {
    setIsGeneratingSpriteSheet(true);
    setGeneratedSpriteSheetUrl(null);
    setSpriteGenerationProgress({ current: 0, total: SPRITE_POSES.length, currentPose: '' });

    try {
        const cleanedPrompt = removePoseFromPrompt(character.positivePrompt);
        const imageUrls: string[] = [];

        for (const [index, pose] of SPRITE_POSES.entries()) {
            setSpriteGenerationProgress({ current: index, total: SPRITE_POSES.length, currentPose: pose });
            const fullPrompt = `${cleanedPrompt}, ${pose}, white background`;
            let imageUrl: string;

            if (useGeminiApi) {
                recordImageApiCall();
                imageUrl = await generateImageWithAi(fullPrompt, 'gemini-2.5-flash-image-preview', '1:1', 256);
            } else {
                const { width, height } = getResolutionForAspectRatio('1:1', 256);
                imageUrl = `https://picsum.photos/seed/${encodeURIComponent(fullPrompt)}/${width}/${height}?t=${Date.now()}`;
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            imageUrls.push(imageUrl);
        }

        setSpriteGenerationProgress({ current: SPRITE_POSES.length, total: SPRITE_POSES.length, currentPose: '結合中' });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context could not be retrieved.');

        const imageSize = 256;
        const cols = 4;
        const rows = Math.ceil(SPRITE_POSES.length / cols);
        canvas.width = cols * imageSize;
        canvas.height = rows * imageSize;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const loadedImages = await Promise.all(imageUrls.map(url => new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            if (url.includes('picsum.photos')) {
                fetch(url).then(res => res.blob()).then(blob => {
                    img.src = URL.createObjectURL(blob);
                });
            } else {
                img.src = url;
            }
        })));
        
        loadedImages.forEach((img, index) => {
            const x = (index % cols) * imageSize;
            const y = Math.floor(index / cols) * imageSize;
            ctx.drawImage(img, x, y, imageSize, imageSize);
        });

        const finalUrl = canvas.toDataURL('image/png');
        setGeneratedSpriteSheetUrl(finalUrl);
    } catch (error) {
        if ((error as Error).message !== "Token limit exceeded") {
          console.error('Sprite sheet generation failed:', error);
          handleApiError(error);
        }
    } finally {
        setIsGeneratingSpriteSheet(false);
        setSpriteGenerationProgress(null);
    }
  };
  
  const handleDownloadSpriteSheet = () => {
    if (generatedSpriteSheetUrl && generatingSpriteSheetFor) {
      if (window.confirm('このスプライトシートをダウンロードしますか？')) {
        downloadFile(generatedSpriteSheetUrl, `${generatingSpriteSheetFor.params.name}-spritesheet.png`);
      }
    }
  };


  // --- リリック・アニメーター ハンドラ関数 ---
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('audio/')) {
        alert('音声ファイルを選択してください。');
        if(audioFileInputRef.current) audioFileInputRef.current.value = "";
        return;
    }

    setIsTranscribing(true);

    if (useGeminiApi) {
        try {
            recordApiCall();
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64Data = (reader.result as string).split(',')[1];
                    const audioPart = {
                        inlineData: { mimeType: file.type, data: base64Data },
                    };
                    const textPart = { text: 'この音声ファイルの内容を日本語の歌詞として書き起こしてください。' };

                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: { parts: [audioPart, textPart] },
                    });

                    setLyrics(response.text);
                    showToast('✅ 音声から歌詞を抽出しました。');
                } catch (error) {
                    handleApiError(error);
                    setLyrics(`音声の解析に失敗しました: ${error}`);
                } finally {
                    setIsTranscribing(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            handleApiError(error);
            setIsTranscribing(false);
        }
    } else {
        // Simulation mode
        await new Promise(resolve => setTimeout(resolve, 2000));
        setLyrics(`シミュレーションモード:\n風がささやく 午後のひととき\n木漏れ日が揺れる 小さなカフェで\n君と過ごした 時間だけが\n私の宝物だよ`);
        showToast('✅ 音声から歌詞を抽出しました (シミュレーション)。');
        setIsTranscribing(false);
    }

    if(audioFileInputRef.current) audioFileInputRef.current.value = "";
  };

  const addToHistory = (item: Omit<HistoryItem, 'id'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: new Date().toISOString(),
      inputType: activeTab,
      characterSlotIds: characterSlots.map(c => c?.id || null),
      timelineState: currentTimelineState,
      storyboardData: storyboardData,
    };
    setHistory(prev => [newItem, ...prev.slice(0, 9)]);
  };

  const reuseHistory = (item: HistoryItem) => {
    setLyrics(item.lyrics);
    setPrompt(item.prompt);
    setNegativePrompt(item.negativePrompt);
    setAnimationStyle(item.animationStyle || 'auto');
    setVideoDuration(item.videoDuration || 8);
    setVideoAspectRatio(item.aspectRatio || '1:1');
    setVideoGenModel(item.videoGenModel || 'veo-2.0-generate-001');
    const newSlots = (item.characterSlotIds || [])
        .map(id => characters.find(c => c.id === id))
        .filter((c): c is Character => !!c);
    setCharacterSlots(newSlots);
    setTimelineHistory([item.timelineState || { timeline: {}, groups: [] }]);
    setTimelineHistoryIndex(0);
    setStoryboardData(item.storyboardData || [{ id: new Date().toISOString(), scene: 1, time: 0, story: '', scenario: '', angle: '選択なし', notes: '' }]);
    setActiveTab(item.inputType || 'storyboard');
    showToast(`✅ 履歴の設定を読み込みました`);
  };

  const deleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  // --- Storyboard Handlers ---
  const handleStoryboardChange = (id: string, field: keyof Omit<StoryboardItem, 'id' | 'scene'>, value: string | number) => {
    setStoryboardData(prev =>
        prev.map(row => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleAddStoryboardRow = () => {
      setStoryboardData(prev => [
          ...prev,
          {
              id: new Date().toISOString(),
              scene: prev.length + 1,
              time: prev[prev.length - 1]?.time + 2 || 0, // Default to 2s after last one
              story: '',
              scenario: '',
              angle: '選択なし',
              notes: '',
          }
      ]);
  };

  const handleDeleteStoryboardRow = (id: string) => {
      setStoryboardData(prev => prev.filter(row => row.id !== id).map((row, index) => ({ ...row, scene: index + 1 })));
  };

  const handleSplitLyricsIntoStoryboard = () => {
      if (!lyrics) {
        showToast('まず歌詞を入力してください。', '#F44336');
        return;
      }
      const lines = lyrics.split('\n').filter(line => line.trim() !== '');
      if (lines.length === 0) return;

      const timePerLine = videoDuration / lines.length;
      const newStoryboard: StoryboardItem[] = lines.map((line, index) => ({
        id: `${new Date().toISOString()}-${index}`,
        scene: index + 1,
        time: parseFloat((index * timePerLine).toFixed(1)),
        story: line,
        scenario: '',
        angle: '選択なし',
        notes: '',
      }));
      setStoryboardData(newStoryboard);
      showToast(`✅ ${lines.length}行のストーリーボードを生成しました`);
  };

  const handleApplyStoryboardToTimeline = () => {
      // 1. Update main prompt/lyrics
      const fullLyrics = storyboardData.map(row => row.story).join('\n');
      const fullScenario = storyboardData.map(row => {
          const angleKey = row.angle as keyof typeof PARAMETERS.angle.choices;
          const anglePrompt = PARAMETERS.angle.choices[angleKey] || '';
          return `${row.scenario}${anglePrompt ? `, ${anglePrompt}` : ''}`;
      }).filter(Boolean).join('. ');

      setLyrics(fullLyrics);
      setPrompt(fullScenario); // Overwrite prompt with storyboard scenario

      // 2. Generate keyframes from scenario
      let keyframesAddedCount = 0;
      updateTimelineState(prev => {
          const newTimeline = { ...prev.timeline };

          for (const row of storyboardData) {
              const scenarioText = row.scenario;
              if (!scenarioText) continue;

              const scenarioParts = scenarioText.split(/[,、]/).map(s => s.trim());

              for (const part of scenarioParts) {
                  const match = part.match(/(.+?):(.+)/);
                  if (!match) continue;
                  
                  const charName = match[1].trim();
                  const actionText = match[2].trim();

                  const targetChar = characterSlots.find(c => c.params.name === charName);
                  if (!targetChar) continue;

                  let foundPose = Object.keys(PARAMETERS.pose.choices).find(key => actionText.includes(key)) || '';
                  let foundExpression = Object.keys(PARAMETERS.expression.choices).find(key => actionText.includes(key)) || '';
                  
                  if (foundPose || foundExpression) {
                      const charKeyframes = [...(newTimeline[targetChar.id] || [])];
                      const existingKfIndex = charKeyframes.findIndex(kf => kf.time === row.time);

                      if (existingKfIndex !== -1) {
                          charKeyframes[existingKfIndex] = {
                              ...charKeyframes[existingKfIndex],
                              pose: foundPose || charKeyframes[existingKfIndex].pose,
                              expression: foundExpression || charKeyframes[existingKfIndex].expression,
                          };
                      } else {
                          charKeyframes.push({
                              id: `sb-${row.id}-${targetChar.id}-${Date.now()}`,
                              time: row.time,
                              pose: foundPose || '選択なし',
                              expression: foundExpression || '選択なし',
                              interpolation: 'linear',
                          });
                          keyframesAddedCount++;
                      }
                      newTimeline[targetChar.id] = charKeyframes.sort((a, b) => a.time - b.time);
                  }
              }
          }
          return { ...prev, timeline: newTimeline };
      });

      if (keyframesAddedCount > 0) {
        showToast(`✅ タイムラインに${keyframesAddedCount}個のキーフレームを反映しました`);
      } else {
        showToast(`📝 歌詞とプロンプトを更新しました`);
      }
  };

  const handleSaveStoryboardAsCSV = () => {
    if (storyboardData.length === 0) {
        showToast('エクスポートするデータがありません。', '#F44336');
        return;
    }

    const escapeCsvValue = (value: string | number): string => {
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headers = ['scene', 'time', 'story', 'scenario', 'angle', 'notes'];
    const csvContent = [
        headers.join(','),
        ...storyboardData.map(row => [
            row.scene,
            row.time,
            escapeCsvValue(row.story),
            escapeCsvValue(row.scenario),
            escapeCsvValue(row.angle),
            escapeCsvValue(row.notes)
        ].join(','))
    ].join('\n');

    downloadFile(csvContent, 'storyboard.csv', true);
    showToast('✅ ストーリーボードをCSVとして保存しました。');
  };

  const handleLoadStoryboardFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split('\n').filter(line => line.trim() !== '');
                if (lines.length < 2) throw new Error("CSVファイルが空か、ヘッダーしかありません。");

                const headers = lines[0].trim().split(',');
                // A simple validation for headers
                if (headers[0] !== 'scene' || headers[2] !== 'story') {
                    throw new Error("CSVのヘッダーが不正です。");
                }
                
                const newStoryboardData: StoryboardItem[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v) || [];
                    
                    if (values.length >= 6) {
                        newStoryboardData.push({
                            id: `${new Date().toISOString()}-${i}`,
                            scene: parseInt(values[0], 10) || i,
                            time: parseFloat(values[1]) || 0,
                            story: values[2] || '',
                            scenario: values[3] || '',
                            angle: values[4] || '選択なし',
                            notes: values[5] || '',
                        });
                    }
                }
                
                setStoryboardData(newStoryboardData);
                showToast(`✅ ${newStoryboardData.length}行のストーリーボードを読み込みました。`);

            } catch (error) {
                console.error("CSV Parse Error:", error);
                showToast('CSVファイルの読み込みに失敗しました。', '#F44336');
            }
        };
        reader.readAsText(file);
        // Reset input value to allow reloading the same file
        if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };


  const handleDragStart = (e: React.DragEvent, character: Character) => {
    e.dataTransfer.setData("characterId", character.id);
    setDraggingItemId(character.id);
  };
  
  const handleDragEnd = () => {
    setDraggingItemId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).classList.add('drag-over');
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
     (e.currentTarget as HTMLDivElement).classList.remove('drag-over');
  };

  const handleDropOnTimeline = (e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).classList.remove('drag-over');
    const characterId = e.dataTransfer.getData("characterId");

    if (characterSlots.length >= MAX_CHARACTERS_IN_SCENE) {
        showToast(`シーンに追加できるキャラクターは${MAX_CHARACTERS_IN_SCENE}人までです。`, '#F44336');
        return;
    }
    
    if (characterSlots.some(c => c.id === characterId)) {
        showToast('キャラクターは既に追加されています。', '#F44336');
        return;
    }

    const character = characters.find(c => c.id === characterId);
    if (character) {
      setCharacterSlots(prev => [...prev, character]);
      updateTimelineState(prev => ({
          ...prev,
          timeline: { ...prev.timeline, [character.id]: prev.timeline[character.id] || [] }
      }));
    }
  };
  
  const handleRemoveFromTimeline = (characterId: string) => {
      setCharacterSlots(prev => prev.filter(c => c.id !== characterId));
      updateTimelineState(prev => {
          const newTimeline = { ...prev.timeline };
          delete newTimeline[characterId];
          const newGroups = prev.groups
              .map(g => ({ ...g, keyframeRefs: g.keyframeRefs.filter(ref => ref.characterId !== characterId) }))
              .filter(g => g.keyframeRefs.length > 1);
          return { timeline: newTimeline, groups: newGroups };
      });
  };

  const handleSaveKeyframe = (characterId: string, keyframeData: Omit<Keyframe, 'id'>, existingId?: string) => {
      updateTimelineState(prev => {
          const newTimeline = { ...prev.timeline };
          const keyframes = [...(newTimeline[characterId] || [])];
          
          if (existingId) { // Editing existing keyframe
              const index = keyframes.findIndex(kf => kf.id === existingId);
              if (index !== -1) {
                  keyframes[index] = { ...keyframes[index], ...keyframeData };
              }
          } else { // Adding new keyframe
              keyframes.push({ ...keyframeData, id: new Date().toISOString() });
          }
          
          newTimeline[characterId] = keyframes.sort((a, b) => a.time - b.time);
          return { ...prev, timeline: newTimeline };
      });
      setEditingKeyframeInfo(null);
  };

  const handleDeleteKeyframe = (characterId: string, keyframeId: string) => {
      updateTimelineState(prev => {
        const newTimeline = { ...prev.timeline };
        newTimeline[characterId] = (newTimeline[characterId] || []).filter(kf => kf.id !== keyframeId);
        
        const newGroups = prev.groups
            .map(g => ({ ...g, keyframeRefs: g.keyframeRefs.filter(ref => !(ref.characterId === characterId && ref.keyframeId === keyframeId)) }))
            .filter(g => g.keyframeRefs.length > 1);

        return { timeline: newTimeline, groups: newGroups };
      });
      setEditingKeyframeInfo(null);
  };
  
  const handleDuplicateKeyframe = (characterId: string, keyframe: Keyframe) => {
    const newTime = Math.min(videoDuration, keyframe.time + 0.5);
    const newKeyframeData: Omit<Keyframe, 'id'> = {
        time: newTime,
        pose: keyframe.pose,
        expression: keyframe.expression,
        interpolation: keyframe.interpolation,
    };
    handleSaveKeyframe(characterId, newKeyframeData);
    showToast('✅ キーフレームを複製しました');
  };


  const handleDeleteSelectedKeyframes = () => {
    const selectedCount = Object.values(selectedKeyframes).flat().length;
    if (selectedCount === 0) return;

    if (window.confirm(`${selectedCount}個のキーフレームを削除しますか？`)) {
        updateTimelineState(prev => {
            const newTimeline = { ...prev.timeline };

            // Delete keyframes from the timeline
            Object.entries(selectedKeyframes).forEach(([charId, kfIds]) => {
                newTimeline[charId] = (newTimeline[charId] || []).filter(kf => !kfIds.includes(kf.id));
            });

            // Update groups: remove refs to deleted keyframes, and remove groups that become too small
            const newGroups = prev.groups
                .map(g => ({
                    ...g,
                    keyframeRefs: g.keyframeRefs.filter(ref => !(selectedKeyframes[ref.characterId] || []).includes(ref.keyframeId))
                }))
                .filter(g => g.keyframeRefs.length > 1);

            return { timeline: newTimeline, groups: newGroups };
        });

        setSelectedKeyframes({});
        showToast(`${selectedCount}個のキーフレームを削除しました`, '#F44336');
    }
  };
  
  const handleTimelineUndo = () => {
    if (timelineHistoryIndex > 0) {
      setTimelineHistoryIndex(prev => prev - 1);
    }
  };

  const handleTimelineRedo = () => {
    if (timelineHistoryIndex < timelineHistory.length - 1) {
      setTimelineHistoryIndex(prev => prev + 1);
    }
  };

  const zoomWithButtons = (direction: 'in' | 'out') => {
      const timelineRect = timelineContainerRef.current?.getBoundingClientRect();
      if (!timelineRect) return;

      const zoomAmount = 0.25;
      const newZoomLevel = direction === 'in'
          ? Math.min(8, zoomLevel + zoomAmount)
          : Math.max(0.25, zoomLevel - zoomAmount);

      const centerX = timelineRect.width / 2;
      const timeAtCenter = ((centerX + timelineScrollLeft) / (timelineRect.width * zoomLevel)) * videoDuration;
      const newScrollLeft = (timeAtCenter / videoDuration) * (timelineRect.width * newZoomLevel) - centerX;
      
      setZoomLevel(newZoomLevel);
      const maxScroll = (timelineRect.width * newZoomLevel) - timelineRect.width;
      setTimelineScrollLeft(Math.max(0, Math.min(newScrollLeft, maxScroll < 0 ? 0 : maxScroll)));
  };

  const handleZoomIn = () => zoomWithButtons('in');
  const handleZoomOut = () => zoomWithButtons('out');

  const handleTimelineWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const timelineRect = timelineContainerRef.current?.getBoundingClientRect();
    if (!timelineRect) return;

    if (e.ctrlKey || e.metaKey) { // Zooming
      const zoomSpeed = 0.005;
      const newZoomLevel = Math.max(0.25, Math.min(8, zoomLevel - e.deltaY * zoomSpeed));
      const mouseX = e.clientX - timelineRect.left;
      const timeAtCursor = ((mouseX + timelineScrollLeft) / (timelineRect.width * zoomLevel)) * videoDuration;
      const newScrollLeft = (timeAtCursor / videoDuration) * (timelineRect.width * newZoomLevel) - mouseX;

      setZoomLevel(newZoomLevel);
      const maxScroll = (timelineRect.width * newZoomLevel) - timelineRect.width;
      setTimelineScrollLeft(Math.max(0, Math.min(newScrollLeft, maxScroll < 0 ? 0 : maxScroll)));

    } else { // Panning/Scrolling
      const newScrollLeft = timelineScrollLeft + e.deltaX + e.deltaY;
      const maxScroll = (timelineRect.width * zoomLevel) - timelineRect.width;
      setTimelineScrollLeft(Math.max(0, Math.min(newScrollLeft, maxScroll < 0 ? 0 : maxScroll)));
    }
  };

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    e.preventDefault();
    panningRef.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: timelineScrollLeft,
    };
  };

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (!panningRef.current.active) return;
    e.preventDefault();
    const dx = e.clientX - panningRef.current.startX;
    const newScrollLeft = panningRef.current.startScrollLeft - dx;
    const timelineRect = timelineContainerRef.current?.getBoundingClientRect();
    if (!timelineRect) return;
    const maxScroll = (timelineRect.width * zoomLevel) - timelineRect.width;
    setTimelineScrollLeft(Math.max(0, Math.min(newScrollLeft, maxScroll < 0 ? 0 : maxScroll)));
  };

  const handleTimelineMouseUp = () => {
    panningRef.current.active = false;
  };
  
  const handleKeyframeDragStart = (e: React.DragEvent, characterId: string, keyframeId: string) => {
    e.dataTransfer.setData('keyframeId', keyframeId);
    e.dataTransfer.setData('characterId', characterId);
    e.dataTransfer.effectAllowed = 'move';
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
    e.dataTransfer.setDragImage(img, 0, 0);

    const group = getGroupForKeyframe(characterId, keyframeId);
    let dragInfo: any = { characterId, keyframeId, startX: e.clientX };
    
    if (group) {
        dragInfo.groupId = group.id;
        dragInfo.initialTimes = {};
        group.keyframeRefs.forEach(ref => {
            const kf = (animationTimeline[ref.characterId] || []).find(k => k.id === ref.keyframeId);
            if (kf) {
                dragInfo.initialTimes[kf.id] = kf.time;
            }
        });
    }

    setDraggingKeyframe(dragInfo);
  };

  const handleKeyframeDragEnd = () => {
    setDraggingKeyframe(null);
  };

  const handleKeyframeDrop = (e: React.DragEvent, targetCharacterId: string) => {
    e.preventDefault();
    if (!draggingKeyframe) return;
  
    const { characterId: sourceCharacterId, keyframeId, groupId, initialTimes, startX } = draggingKeyframe;
    const timelineContainerRect = timelineContainerRef.current?.getBoundingClientRect();
    if (!timelineContainerRect) return;
  
    if (groupId && initialTimes) { // Group drag
      const pixelDelta = e.clientX - startX;
      const canvasWidth = timelineContainerRect.width * zoomLevel;
      let timeDelta = (pixelDelta / canvasWidth) * videoDuration;
  
      const allKeyframesInGroup = Object.entries(initialTimes);
      let minTime = Infinity, maxTime = -Infinity;
      allKeyframesInGroup.forEach(([_, time]) => {
        if (time < minTime) minTime = time;
        if (time > maxTime) maxTime = time;
      });
  
      if (minTime + timeDelta < 0) timeDelta = -minTime;
      if (maxTime + timeDelta > videoDuration) timeDelta = videoDuration - maxTime;
  
      updateTimelineState(prev => {
        const newTimeline = { ...prev.timeline };
        const group = prev.groups.find(g => g.id === groupId);
        if (!group) return prev;
  
        group.keyframeRefs.forEach(ref => {
          const charKeyframes = [...(newTimeline[ref.characterId] || [])];
          const kfIndex = charKeyframes.findIndex(k => k.id === ref.keyframeId);
          if (kfIndex !== -1 && initialTimes[ref.keyframeId] !== undefined) {
            const newTime = parseFloat((initialTimes[ref.keyframeId] + timeDelta).toFixed(2));
            charKeyframes[kfIndex] = { ...charKeyframes[kfIndex], time: newTime };
            newTimeline[ref.characterId] = charKeyframes.sort((a,b) => a.time - b.time);
          }
        });
        return { ...prev, timeline: newTimeline };
      });
    } else { // Single keyframe drag
      if (sourceCharacterId !== targetCharacterId) return;
  
      const dropXInContainer = e.clientX - timelineContainerRect.left;
      const positionOnCanvas = dropXInContainer + timelineScrollLeft;
      const canvasWidth = timelineContainerRect.width * zoomLevel;
      const newTimePercent = Math.max(0, Math.min(1, positionOnCanvas / canvasWidth));
      const newTime = parseFloat((newTimePercent * videoDuration).toFixed(2));
  
      const keyframeToMove = (animationTimeline[sourceCharacterId] || []).find(k => k.id === keyframeId);
      if (keyframeToMove) {
        handleSaveKeyframe(sourceCharacterId, { ...keyframeToMove, time: newTime }, keyframeId);
      }
    }
  };

  const handleToggleKeyframeSelection = (characterId: string, keyframeId: string) => {
    setSelectedKeyframes(prev => {
        const currentSelection = prev[characterId] || [];
        const newSelection = currentSelection.includes(keyframeId)
            ? currentSelection.filter(id => id !== keyframeId)
            : [...currentSelection, keyframeId];

        const newState = { ...prev };
        if (newSelection.length === 0) {
            delete newState[characterId];
        } else {
            newState[characterId] = newSelection;
        }
        return newState;
    });
  };
    
  const getSelectedKeyframeInfo = useCallback(() => {
    const charId = Object.keys(selectedKeyframes)[0];
    if (!charId || selectedKeyframes[charId]?.length !== 2) {
        return null;
    }
    const keyframeIds = selectedKeyframes[charId];
    const keyframes = animationTimeline[charId] || [];
    const kf1_candidate = keyframes.find(k => k.id === keyframeIds[0]);
    const kf2_candidate = keyframes.find(k => k.id === keyframeIds[1]);
    
    if (!kf1_candidate || !kf2_candidate) return null;

    // Ensure they are ordered by time
    const [kf1, kf2] = [kf1_candidate, kf2_candidate].sort((a,b) => a.time - b.time);
    
    return { kf1, kf2, charId };
  }, [selectedKeyframes, animationTimeline]);

  const handleGenerateIntermediateFrames = (count: number) => {
    const selectionInfo = getSelectedKeyframeInfo();
    if (!selectionInfo) return;

    const { kf1, kf2, charId } = selectionInfo;
    const newKeyframes: Omit<Keyframe, 'id'>[] = [];
    const easingFunc = easingFunctions[kf1.interpolation] || easingFunctions.linear;
    const timeDiff = kf2.time - kf1.time;

    for (let i = 1; i <= count; i++) {
        const progress = i / (count + 1);
        const easedProgress = easingFunc(progress);
        const newTime = parseFloat((kf1.time + timeDiff * easedProgress).toFixed(2));
        
        newKeyframes.push({
            time: newTime,
            pose: kf1.pose,
            expression: kf1.expression,
            interpolation: kf1.interpolation, 
        });
    }

    updateTimelineState(prev => {
        const timeline = { ...prev.timeline };
        const charKeyframes = timeline[charId] || [];
        const finalNewKeyframes = newKeyframes.map(kf => ({ ...kf, id: `intermediate-${Date.now()}-${Math.random()}` }));
        const updatedKeyframes = [...charKeyframes, ...finalNewKeyframes].sort((a, b) => a.time - b.time);
        timeline[charId] = updatedKeyframes;
        return { ...prev, timeline };
    });

    // Cleanup
    setSelectedKeyframes({});
    setIsIntermediateModalOpen(false);
    showToast(`✅ ${count}個の中間キーフレームを生成しました`);
  };

  const handleGroup = () => {
    const allSelectedRefs = Object.entries(selectedKeyframes).flatMap(([charId, kfIds]) =>
        kfIds.map(kfId => ({ characterId: charId, keyframeId: kfId }))
    );
    if (allSelectedRefs.length < 2) return;

    const newGroup: KeyframeGroup = {
        id: `group-${Date.now()}`,
        name: `Group ${keyframeGroups.length + 1}`,
        keyframeRefs: allSelectedRefs,
        color: generateRandomColor(),
    };
    updateTimelineState(prev => ({ ...prev, groups: [...prev.groups, newGroup] }));
    setSelectedKeyframes({});
  };

  const handleUngroup = () => {
    const groupsToUngroup = new Set<string>();
    Object.entries(selectedKeyframes).forEach(([charId, kfIds]) => {
        kfIds.forEach(kfId => {
            const group = getGroupForKeyframe(charId, kfId);
            if (group) groupsToUngroup.add(group.id);
        });
    });

    if (groupsToUngroup.size > 0) {
        updateTimelineState(prev => ({
            ...prev,
            groups: prev.groups.filter(g => !groupsToUngroup.has(g.id))
        }));
    }
  };
  
  const handleCopy = () => {
      const allSelected = Object.entries(selectedKeyframes).flatMap(([charId, kfIds]) =>
          (animationTimeline[charId] || []).filter(kf => kfIds.includes(kf.id)).map(kf => ({ ...kf, characterId: charId }))
      );
      if (allSelected.length === 0) return;

      const minTime = Math.min(...allSelected.map(kf => kf.time));

      setClipboard({
          keyframes: allSelected.map(kf => ({ ...kf, time: kf.time - minTime }))
      });
      showToast(`✅ ${allSelected.length}個のキーフレームをコピーしました`);
  };

  const handlePaste = () => {
    if (!clipboard) {
        showToast('クリップボードが空です。', '#F44336');
        return;
    }

    // 1. Determine target time and character from selection
    const selectedEntries = Object.entries(selectedKeyframes).filter(([, kfIds]) => kfIds && kfIds.length > 0);
    let pasteStartTime = 0;
    let targetCharacterIdForRemapping: string | null = null;

    if (selectedEntries.length > 0) {
        const allSelectedKeyframes = selectedEntries.flatMap(([charId, kfIds]) => 
            (animationTimeline[charId] || []).filter(kf => kfIds.includes(kf.id))
        );
        if (allSelectedKeyframes.length > 0) {
            pasteStartTime = Math.min(...allSelectedKeyframes.map(kf => kf.time));
        }
        if (selectedEntries.length === 1) {
            targetCharacterIdForRemapping = selectedEntries[0][0];
        }
    }
    
    // 2. Prepare new keyframes
    const wasCopiedFromSingleCharacter = new Set(clipboard.keyframes.map(k => k.characterId)).size === 1;
    const newKeyframesByChar: Record<string, Keyframe[]> = {};
    const newKeyframeRefs: { characterId: string, keyframeId: string }[] = [];

    for (const kfData of clipboard.keyframes) {
        const finalTargetCharId = (wasCopiedFromSingleCharacter && targetCharacterIdForRemapping)
            ? targetCharacterIdForRemapping
            : kfData.characterId;
        
        if (!characterSlots.some(c => c.id === finalTargetCharId)) {
            continue; // Skip if target character is not on timeline
        }

        const newTime = parseFloat((pasteStartTime + kfData.time).toFixed(2));
        if (newTime > videoDuration) {
            continue; // Skip if keyframe is out of bounds
        }
        
        const newId = `pasted-${Date.now()}-${Math.random()}`;
        const newKeyframe: Keyframe = {
            id: newId,
            time: newTime,
            pose: kfData.pose,
            expression: kfData.expression,
            interpolation: kfData.interpolation,
        };

        if (!newKeyframesByChar[finalTargetCharId]) {
            newKeyframesByChar[finalTargetCharId] = [];
        }
        newKeyframesByChar[finalTargetCharId].push(newKeyframe);
        newKeyframeRefs.push({ characterId: finalTargetCharId, keyframeId: newId });
    }
    
    if (newKeyframeRefs.length === 0) {
        showToast('ペースト可能なキーフレームがありませんでした。', '#F44336');
        return;
    }

    // 3. Update state
    updateTimelineState(prev => {
        const newTimeline = { ...prev.timeline };
        Object.entries(newKeyframesByChar).forEach(([charId, kfs]) => {
            newTimeline[charId] = [...(newTimeline[charId] || []), ...kfs].sort((a, b) => a.time - b.time);
        });

        const newGroups = [...prev.groups];
        if (newKeyframeRefs.length > 1) {
            newGroups.push({
                id: `group-pasted-${Date.now()}`,
                name: `Pasted Group`,
                keyframeRefs: newKeyframeRefs,
                color: generateRandomColor(),
            });
        }
        return { timeline: newTimeline, groups: newGroups };
    });

    // 4. Select newly pasted keyframes
    const newSelection: Record<string, string[]> = {};
    newKeyframeRefs.forEach(ref => {
        if (!newSelection[ref.characterId]) newSelection[ref.characterId] = [];
        newSelection[ref.characterId].push(ref.keyframeId);
    });
    setSelectedKeyframes(newSelection);
    showToast(`📋 ${newKeyframeRefs.length}個のキーフレームを貼り付けました`);
  };


  const createVideoPrompt = (duration: number) => {
    const promptParts: string[] = [];
    const selectedChars = characterSlots;

    // 1. Character and Animation Instructions
    if (selectedChars.length > 0) {
      const hasAnyKeyframes = selectedChars.some(char => (animationTimeline[char.id] || []).length > 0);
      
      if (hasAnyKeyframes) {
        if (selectedChars.length > 1) {
            promptParts.push(`以下のキャラクターは同じシーンに登場し、互いに関わることがあります。シーンの連続性とキャラクター間の一貫性を考慮してください。`);
        }
        
        const animationInstructions = selectedChars.map(char => {
            const keyframes = (animationTimeline[char.id] || []).sort((a, b) => a.time - b.time);
            const basePrompt = removePoseFromPrompt(char.positivePrompt);
            if (keyframes.length === 0) {
                return `--- Character: ${char.params.name} ---\nBase Prompt: ${basePrompt}\n(No specific animation instructions, present throughout)\n---`;
            }
            const keyframeDescriptions = keyframes.map(kf => {
                const poseText = PARAMETERS.pose.choices[kf.pose as keyof typeof PARAMETERS.pose.choices] || kf.pose;
                const exprText = PARAMETERS.expression.choices[kf.expression as keyof typeof PARAMETERS.expression.choices] || kf.expression;
                return `  - At ${kf.time.toFixed(1)}s: pose is '${poseText}', expression is '${exprText}'. Transition to next keyframe should be '${kf.interpolation}'.`;
            }).join('\n');
            return `--- Character: ${char.params.name} ---\nBase Prompt: ${basePrompt}\nAnimation Keyframes:\n${keyframeDescriptions}\n---`;
        }).join('\n\n');

        promptParts.push(`登場キャラクターとアニメーション指示:\n${animationInstructions}`);
      } else {
        const characterList = selectedChars.map(char => `- ${char.params.name}: ${removePoseFromPrompt(char.positivePrompt)}`).join('\n');
        promptParts.push(`登場キャラクター:\n${characterList}`);
      }
    }

    // 2. Main Instruction and Details
    const mainInstruction = `以下の情報に基づいてアニメ風の短い動画を生成してください。`;
    const details = [
      `ビデオの長さ: ${duration}秒`,
      `アスペクト比: ${videoAspectRatio}`,
      (animationStyle && animationStyle !== 'auto') && `アニメーションスタイル: ${animationStyle}`,
       prompt && `テーマ: ${prompt}`,
       lyrics && `ストーリー:\n---\n${lyrics}\n---`,
       negativePrompt && `ネガティブプロンプト: ${negativePrompt}`
    ].filter(Boolean).join('\n');

    // Combine parts only if they have content.
    if (promptParts.length > 0) {
        return [mainInstruction, details, ...promptParts].filter(p => p && p.trim() !== '').join('\n\n');
    } else if (details) {
        return [mainInstruction, details].filter(p => p && p.trim() !== '').join('\n\n');
    }
    return '';
  };

  const optimizePrompt = async (originalPrompt: string): Promise<string> => {
    if (!useGeminiApi) {
        console.log("シミュレーションモード: プロンプト最適化はスキップされました。");
        return originalPrompt;
    }

    try {
        recordApiCall();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `以下の動画生成AI用のプロンプトを、意味を維持したままトークン数を削減するように最適化してください。最適化されたプロンプトのみを返し、余分なテキストや説明は含めないでください。\n\n---\n${originalPrompt}\n---`,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Prompt optimization failed:", error);
        handleApiError(error);
        // On failure, return the original prompt to not break the flow.
        return originalPrompt;
    }
  };

  const handleGeneratePreview = async () => {
    if (!lyrics && !prompt && characterSlots.length === 0) {
      alert('歌詞、プロンプト、またはキャラクターのいずれかを入力してください。');
      return;
    }

    setIsPreviewLoading(true);
    setGeneratedVideoUrl(null);
    setGeneratedPreviewUrl(null);

    const loadingMessages = [
        "プレビューの解釈を開始... (シミュレーション)",
        "プレビューシーンを構成中...",
        "プレビューを高速レンダリング中..."
    ];

    let messageIndex = 0;
    setLoadingMessage(loadingMessages[messageIndex]);
    const interval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
    }, 1500);

    const previewDuration = Math.max(2, Math.floor(videoDuration / 2));
    const fullPrompt = createVideoPrompt(previewDuration);
    
    console.log(`--- プレビュー生成プロンプト (最適化: ${isPromptOptimizationEnabled ? 'ON' : 'OFF'}) ---`);
    console.log(fullPrompt);
    console.log("-----------------------------------------");

    setTimeout(() => {
        const sampleVideoUrl = `https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?t=${Date.now()}`;
        setGeneratedPreviewUrl(sampleVideoUrl);
        setIsPreviewLoading(false);
        clearInterval(interval);
        setLoadingMessage('');
    }, 4000);
  };

  const handleGenerateVideo = async () => {
    if (!lyrics && !prompt && characterSlots.length === 0) {
        alert('歌詞、プロンプト、またはキャラクターのいずれかを入力してください。');
        return;
    }

    const fullPrompt = createVideoPrompt(videoDuration);
    if (!checkTokenLimit(fullPrompt, FREE_TIER_VIDEO_TOKEN_LIMIT)) {
        return; // Stop if token limit is exceeded
    }

    setIsLoading(true);
    setGeneratedPreviewUrl(null);
    setGeneratedVideoUrl(null);

    const selectedModel = VIDEO_GEN_MODELS[videoGenModel];
    const isApiMode = useGeminiApi && selectedModel.type === 'api';
    
    console.log(`動画生成モード: ${isApiMode ? 'API (' + selectedModel.name + ')' : 'シミュレーション (' + selectedModel.name + ')'}, プロンプト最適化: ${isPromptOptimizationEnabled}`);

    if (isApiMode) {
        try {
            let finalPrompt = fullPrompt;
            if (isPromptOptimizationEnabled) {
                setLoadingMessage('プロンプトを最適化中...');
                finalPrompt = await optimizePrompt(fullPrompt);
                console.log("--- 最適化された動画生成プロンプト ---");
                console.log(finalPrompt);
            } else {
                console.log("--- 動画生成プロンプト ---");
                console.log(fullPrompt);
            }
            
            recordVideoApiCall();

            setLoadingMessage('動画生成リクエストを送信中...');
            let operation = await ai.models.generateVideos({
                model: videoGenModel,
                prompt: finalPrompt,
                config: { numberOfVideos: 1 }
            });

            let checks = 0;
            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
                operation = await ai.operations.getVideosOperation({ operation: operation });
                checks++;
                setLoadingMessage(`動画生成中... (${checks * 10}秒経過)`);
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) throw new Error('動画の生成に失敗しました (APIからのリンクがありません)。');

            setLoadingMessage('動画データをダウンロード中...');
            const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            if (!response.ok) throw new Error(`動画のダウンロードに失敗しました: ${response.statusText}`);

            const videoBlob = await response.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            
            setGeneratedVideoUrl(videoUrl);
            addToHistory({ lyrics, prompt, negativePrompt, animationStyle, videoDuration, characterSlotIds: characterSlots.map(c => c?.id || null), aspectRatio: videoAspectRatio, videoGenModel });
            showToast('✅ 動画が生成されました！');
        } catch(error) {
            handleApiError(error);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    } else { // Simulation mode
        console.log("--- 動画生成プロンプト (シミュレーション) ---");
        console.log(fullPrompt);
        let loadingMessages: string[];
        switch(videoGenModel) {
            case 'deevid-ai':
                loadingMessages = [
                    "DeeVid AI パイプラインを初期化中... (シミュレーション)",
                    "シーケンスデータを準備しています...",
                    "差分拡散モデルを実行中...",
                    "フレームをレンダリングしています..."
                ];
                break;
            case 'nolang':
                loadingMessages = [
                    "NoLang 概念マッピングを解析中... (シミュレーション)",
                    "ワールドモデルを構築しています...",
                    "視覚化レイヤーを生成中...",
                    "ビデオストリームをコンパイルしています..."
                ];
                break;
            case 'stable-video':
                loadingMessages = [
                    "Stable Video Diffusion をセットアップ中... (シミュレーション)",
                    "潜在空間でノイズを除去しています...",
                    "フレームの一貫性を調整中...",
                    "最終的な動画を出力しています..."
                ];
                break;
            default: // includes veo-2.0-generate-001 in sim mode
                loadingMessages = [
                    "入力を解釈しています... (シミュレーション)",
                    "シーンを構成中...",
                    "キャラクターを描画中...",
                    "背景を生成しています...",
                    "動画をレンダリング中です。もうしばらくお待ちください..."
                ];
        }

        let messageIndex = 0;
        setLoadingMessage(loadingMessages[messageIndex]);
        const interval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            setLoadingMessage(loadingMessages[messageIndex]);
        }, 5000);

        setTimeout(() => {
            const sampleVideoUrl = `https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?t=${Date.now()}`;
            setGeneratedVideoUrl(sampleVideoUrl);
            addToHistory({ lyrics, prompt, negativePrompt, animationStyle, videoDuration, characterSlotIds: characterSlots.map(c => c?.id || null), aspectRatio: videoAspectRatio, videoGenModel });

            setIsLoading(false);
            clearInterval(interval);
            setLoadingMessage('');
        }, 12000);
    }
  };

  const handleDownloadVideo = () => {
    if (generatedVideoUrl) {
      if (window.confirm('この動画をダウンロードしますか？')) {
        downloadFile(generatedVideoUrl, 'lyric-animation.mp4');
      }
    }
  };

  const handleDownloadCharacterImage = (character: Character) => {
    if (window.confirm(`${character.params.name} の画像をダウンロードしますか？`)) {
        downloadFile(character.params.imageUrl, `${character.params.name}.jpg`);
    }
  };

  // --- 中間フレーム生成 ハンドラ関数 ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setImage: React.Dispatch<React.SetStateAction<string | null>>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    } else {
        alert('画像ファイルを選択してください。');
    }
    e.target.value = ''; // Reset input to allow re-uploading the same file
  };
  
    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('video/')) {
            setUploadedVideo(file);
            setStartImage(null);
            setEndImage(null);
            setIsProcessingVideo(true);
            const video = document.createElement('video');
            video.preload = 'metadata';
            const videoUrl = URL.createObjectURL(file);
            video.src = videoUrl;

            const cleanup = () => {
                URL.revokeObjectURL(videoUrl);
                setIsProcessingVideo(false);
            };

            video.onloadedmetadata = () => {
                if (video.duration > 0 && video.videoWidth > 0 && video.videoHeight > 0) {
                    video.currentTime = video.duration;
                } else {
                    alert('動画のメタデータを読み込めませんでした。');
                    cleanup();
                }
            };

            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const lastFrameUrl = canvas.toDataURL('image/jpeg');
                    setStartImage(lastFrameUrl);
                } else {
                    alert('フレームの抽出に失敗しました。');
                }
                cleanup();
            };

            video.onerror = () => {
                alert('動画の処理に失敗しました。');
                cleanup();
            };
        } else {
            alert('動画ファイルを選択してください。');
        }
        e.target.value = '';
    };

    const handleGenerateEndImageFromPrompt = async () => {
        if (!startImage || !endImagePrompt) {
            alert('開始画像とプロンプトが必要です。動画をアップロードして、プロンプトを入力してください。');
            return;
        }
        setIsGeneratingEndImage(true);
        setEndImage(null);

        try {
            if (!checkTokenLimit(endImagePrompt, FREE_TIER_IMAGE_TOKEN_LIMIT)) {
                return;
            }

            if (useGeminiApi) {
                recordImageApiCall();
                const base64Data = startImage.split(',')[1];
                const imagePart = {
                    inlineData: { data: base64Data, mimeType: 'image/jpeg' },
                };
                const textPart = { text: endImagePrompt };
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image-preview',
                    contents: { parts: [imagePart, textPart] },
                    config: {
                        responseModalities: [Modality.IMAGE, Modality.TEXT],
                    },
                });

                const imagePartResponse = response.candidates[0].content.parts.find(part => part.inlineData);
                if (imagePartResponse && imagePartResponse.inlineData) {
                    const base64ImageBytes = imagePartResponse.inlineData.data;
                    const imageUrl = `data:${imagePartResponse.inlineData.mimeType};base64,${base64ImageBytes}`;
                    setEndImage(imageUrl);
                } else {
                    throw new Error('AIから画像が返されませんでした。');
                }
            } else {
                // Simulation mode
                const {width, height} = getResolutionForAspectRatio(framerAspectRatio);
                const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(endImagePrompt)}/${width}/${height}?t=${Date.now()}`;
                await new Promise(resolve => setTimeout(resolve, 500));
                setEndImage(imageUrl);
            }
        } catch (error) {
            handleApiError(error);
        } finally {
            setIsGeneratingEndImage(false);
        }
    };


  const handleGenerateFrames = async () => {
      if (!startImage || !endImage) {
          alert('開始画像と終了画像を両方アップロードしてください。');
          return;
      }
      setIsGeneratingFrames(true);
      setGeneratedFrames([]);
      setLoadingMessage('中間フレームを生成しています...');

      // シミュレーション: 5秒後に指定された枚数の画像を生成
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const {width, height} = getResolutionForAspectRatio(framerAspectRatio);
      const frames = Array.from({ length: frameCount }, (_, i) => `https://picsum.photos/seed/frame${Date.now() + i}/${width}/${height}`);
      setGeneratedFrames(frames);
      setIsGeneratingFrames(false);
      setLoadingMessage('');
  };

  const handleGenerateAnimationFromImage = async () => {
    if (!startImage || !animationPrompt) {
        alert('開始画像とプロンプトを両方入力してください。');
        return;
    }
    if (!checkTokenLimit(animationPrompt, FREE_TIER_VIDEO_TOKEN_LIMIT)) { // Use video limit for animation
        return;
    }

    setIsGeneratingFrames(true);
    setGeneratedFrames([]);
    setLoadingMessage('アニメーション生成の準備をしています...');

    try {
        if (useGeminiApi) {
            recordVideoApiCall();
            setLoadingMessage('VEOモデルで動画を生成中... これには数分かかる場合があります。');
            
            const base64Data = startImage.split(',')[1];
            const mimeType = startImage.match(/data:(.*);base64,/)?.[1] || 'image/jpeg';
            
            let operation = await ai.models.generateVideos({
              model: 'veo-2.0-generate-001',
              prompt: animationPrompt,
              image: { imageBytes: base64Data, mimeType: mimeType },
              config: { numberOfVideos: 1 }
            });

            let checks = 0;
            while (!operation.done) {
              await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
              operation = await ai.operations.getVideosOperation({ operation: operation });
              checks++;
              setLoadingMessage(`動画生成中... (${checks * 10}秒経過)`);
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) throw new Error('動画の生成に失敗しました。');

            setLoadingMessage('動画からフレームを抽出しています...');
            const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            const videoBlob = await response.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            
            const frames = await extractFramesFromVideo(videoUrl, frameCount);
            setGeneratedFrames(frames);
            URL.revokeObjectURL(videoUrl);

        } else { // Simulation mode
            setLoadingMessage('アニメーションをシミュレート中...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            const {width, height} = getResolutionForAspectRatio(framerAspectRatio);
            const frames = Array.from({ length: frameCount }, (_, i) => `https://picsum.photos/seed/anim-frame-${Date.now()+i}/${width}/${height}?grayscale&blur=${Math.floor((frameCount-i-1)/4)}`);
            setGeneratedFrames(frames);
        }
    } catch (error) {
        handleApiError(error);
        alert('アニメーションフレームの生成に失敗しました。');
    } finally {
        setIsGeneratingFrames(false);
        setLoadingMessage('');
    }
  };

  const handleDownloadFrame = (url: string, index: number) => {
    if (window.confirm(`フレーム ${index + 1} をダウンロードしますか？`)) {
        downloadFile(url, `frame_${index + 1}.jpg`);
    }
  };
  
    // --- Framer AI Toolkit Handlers ---
  const handleInspectImage = async () => {
    if (!inspectorImage) {
        alert('画像をアップロードしてください。');
        return;
    }
    setIsInspectingImage(true);
    setInspectorPrompt('');
    
    try {
      if (useGeminiApi) {
        recordApiCall();
        const base64Data = inspectorImage.split(',')[1];
        const imagePart = { inlineData: { mimeType: 'image/jpeg', data: base64Data } };
        const textPart = { text: 'この画像の内容を詳細に説明する、再現性の高いプロンプトを生成してください。' };
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [imagePart, textPart] },
        });
        setInspectorPrompt(response.text);
      } else {
        // Simulation mode
        await new Promise(resolve => setTimeout(resolve, 1500));
        setInspectorPrompt('シミュレーションモード: A beautiful anime girl with long silver hair standing in a glowing magical forest at night.');
      }
    } catch (error) {
      handleApiError(error);
      setInspectorPrompt('解析エラーが発生しました。');
    } finally {
      setIsInspectingImage(false);
    }
  };

  const handlePaintImage = async () => {
    if (!painterPrompt) {
      alert('プロンプトを入力してください。');
      return;
    }
    setIsPaintingImage(true);
    setPainterGeneratedImage(null);
    try {
      if (useGeminiApi) {
        recordImageApiCall();
        const imageUrl = await generateImageWithAi(painterPrompt, painterModel, painterAspectRatio);
        setPainterGeneratedImage(imageUrl);
      } else {
        // Simulation mode
        const { width, height } = getResolutionForAspectRatio(painterAspectRatio);
        const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(painterPrompt)}/${width}/${height}?t=${Date.now()}`;
        await new Promise(resolve => setTimeout(resolve, 500));
        setPainterGeneratedImage(imageUrl);
      }
    } catch (error) {
      if ((error as Error).message !== "Token limit exceeded") {
        handleApiError(error);
      }
    } finally {
      setIsPaintingImage(false);
    }
  };


  // --- アイコンコンポーネント ---
  const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 9.293a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );

  const SaveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586L7.707 10.293zM3 8a1 1 0 011-1h2a1 1 0 110 2H4a1 1 0 01-1-1zm14 0a1 1 0 00-1-1h-2a1 1 0 100 2h2a1 1 0 001-1z" />
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  );

  const LoadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M8.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414L11 8.586V3a1 1 0 10-2 0v5.586L8.707 7.293z" />
        <path d="M3 11a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
    </svg>
  );

  const UploadIcon = ({ small=false }: { small?: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${small ? 'h-6 w-6' : 'h-10 w-10'} mx-auto text-gray-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );

  const VideoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );

  const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
    </svg>
  );
  
  const SpriteSheetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );

  const KeyframeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  );

  const UndoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8A5 5 0 009 9V5" />
    </svg>
  );

  const RedoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 15l3-3m0 0l-3-3m3 3H8A5 5 0 003 9V5" />
    </svg>
  );

  const CopyIcon = ({small=false}: {small?: boolean}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={small ? "h-4 w-4" : "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );

  const PasteIcon = ({small=false}: {small?: boolean}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={small ? "h-4 w-4" : "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );

  const SparklesIcon = ({small=false}: {small?: boolean}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={small ? "h-4 w-4" : "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1.586l.707-.707a1 1 0 011.414 0l.707.707.707-.707a1 1 0 111.414 1.414l-.707.707.707.707a1 1 0 010 1.414l-.707.707.707.707a1 1 0 11-1.414 1.414l-.707-.707-.707.707a1 1 0 01-1.414 0l-.707-.707-.707.707a1 1 0 01-1.414-1.414l.707-.707-.707-.707a1 1 0 010-1.414l.707-.707-.707-.707a1 1 0 011.414-1.414l.707.707V3a1 1 0 011-1zm0 10a1 1 0 011 1v1.586l.707-.707a1 1 0 011.414 0l.707.707.707-.707a1 1 0 111.414 1.414l-.707.707.707.707a1 1 0 010 1.414l-.707.707.707.707a1 1 0 11-1.414 1.414l-.707-.707-.707.707a1 1 0 01-1.414 0l-.707-.707-.707.707a1 1 0 01-1.414-1.414l.707-.707-.707-.707a1 1 0 010-1.414l.707-.707-.707-.707a1 1 0 011.414-1.414l.707.707V13a1 1 0 011-1zm10-5a1 1 0 011 1v1.586l.707-.707a1 1 0 011.414 0l.707.707.707-.707a1 1 0 111.414 1.414l-.707.707.707.707a1 1 0 010 1.414l-.707.707.707.707a1 1 0 11-1.414 1.414l-.707-.707-.707.707a1 1 0 01-1.414 0l-.707-.707-.707.707a1 1 0 01-1.414-1.414l.707-.707-.707-.707a1 1 0 010-1.414l.707-.707-.707-.707a1 1 0 011.414-1.414l.707.707V8a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  );
  
  const GroupIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
    </svg>
  );

  const UngroupIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );

  const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
  );

  // --- レンダリングコンポーネント ---
  const QuotaCostIndicator = ({ type, amount, isApplicable = true }: { type: 'image' | 'video', amount: number, isApplicable?: boolean }) => {
    if (!isQuotaCostVisible || !isApplicable || !useGeminiApi) return null;
    const isImage = type === 'image';
    return (
      <div className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${isImage ? 'bg-cyan-900 text-cyan-300' : 'bg-purple-900 text-purple-300'}`}>
        消費: {amount} {isImage ? '画像' : '動画'}クォータ
      </div>
    );
  };

  const InterpolationPreview = ({ type }: { type: InterpolationType }) => {
    const easingFunc = easingFunctions[type];
    if (!easingFunc) return null;

    const points = Array.from({ length: 51 }, (_, i) => {
        const t = i / 50;
        return `${t * 100},${100 - easingFunc(t) * 100}`;
    }).join(' ');

    return (
        <div className="flex flex-col items-center">
            <svg viewBox="0 0 100 100" className="w-16 h-16 bg-gray-900 rounded-md border border-gray-600">
                <polyline
                    points={points}
                    fill="none"
                    stroke="#818cf8" // indigo-400
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <p className="text-xs text-gray-400 mt-1">{INTERPOLATION_TYPES[type]}</p>
        </div>
    );
  };

  const AspectRatioSelector = ({ value, onChange, labelId, label = "アスペクト比" }: { value: AspectRatio, onChange: (value: AspectRatio) => void, labelId: string, label?: string }) => (
      <div>
        <label htmlFor={labelId} className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
        <select
          id={labelId}
          value={value}
          onChange={(e) => onChange(e.target.value as AspectRatio)}
          className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          aria-label={label}
        >
          {ASPECT_RATIOS.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
        </select>
      </div>
  );

  const ModelSelector = ({ value, onChange, options, labelId, label }: { value: string, onChange: (value: any) => void, options: Record<string, string>, labelId: string, label: string }) => (
    <div>
      <label htmlFor={labelId} className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <select
        id={labelId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
        aria-label={label}
      >
        {Object.entries(options).map(([val, name]) => <option key={val} value={val}>{name}</option>)}
      </select>
    </div>
  );
  
  const ImageUploadBox = ({ image, onImageUpload, title, inputId, aspectRatio, small=false }: { image: string | null, onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void, title?: string, inputId: string, aspectRatio: AspectRatio, small?: boolean }) => (
    <div className={`bg-gray-800 ${small ? 'p-3' : 'p-6'} rounded-2xl shadow-lg flex flex-col items-center gap-4`}>
      {title && <h2 className="text-xl font-bold text-gray-300">{title}</h2>}
      <div className={`w-full ${getAspectRatioClass(aspectRatio)} bg-gray-900 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center relative`}>
        <input
          type="file"
          accept="image/*"
          onChange={onImageUpload}
          className="hidden"
          id={inputId}
        />
        <label htmlFor={inputId} className="group cursor-pointer w-full h-full flex items-center justify-center">
          {image ? (
            <img src={image} alt={title || 'アップロード画像'} className="w-full h-full object-contain rounded-lg p-2" />
          ) : (
            <div className="text-center text-gray-500 transition-transform group-hover:scale-105">
              <UploadIcon small={small} />
              <p className={small ? 'text-xs' : ''}>画像を選択</p>
            </div>
          )}
        </label>
        {image && (
          <label htmlFor={inputId} className="absolute bottom-2 right-2 bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition cursor-pointer transform hover:scale-110" aria-label="画像を編集">
            <EditIcon />
          </label>
        )}
      </div>
    </div>
  );

  const CharacterList = ({isDraggable}: {isDraggable: boolean}) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      {Array.isArray(characters) && characters.map((char: Character) => (
        <div 
          key={char.id} 
          draggable={isDraggable} 
          onClick={!isDraggable ? () => handleSelectCharacterForEditing(char) : undefined}
          onDragStart={isDraggable ? (e) => handleDragStart(e, char) : undefined} 
          onDragEnd={isDraggable ? handleDragEnd : undefined} 
          className={`group relative rounded-lg overflow-hidden transition-all ${isDraggable ? 'cursor-grab' : 'cursor-pointer'} ${draggingItemId === char.id ? 'dragging' : ''} ${Array.isArray(characterSlots) && characterSlots.some(s => s?.id === char.id) ? 'opacity-40 cursor-not-allowed' : ''} hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/20 ${editingCharacter?.id === char.id ? 'ring-2 ring-indigo-500' : ''}`}>
          <img src={char.params.imageUrl} alt={char.params.name} className="w-full h-24 object-cover pointer-events-none" />
          <div className="absolute inset-0 bg-black/50 flex items-end p-1">
            <p className="text-xs font-bold text-white truncate">{char.params.name}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(char.id); }} className="absolute top-1 right-1 bg-red-600/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
          <button onClick={(e) => { e.stopPropagation(); handleDownloadCharacterImage(char); }} className="absolute top-1 left-1 bg-gray-800/70 text-white p-1 rounded-full hover:bg-gray-700 transition opacity-0 group-hover:opacity-100" aria-label={`${char.params.name}の画像をダウンロード`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 9.293a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
          {!isDraggable && (
              <div className="absolute bottom-1 right-1 flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <QuotaCostIndicator type="image" amount={SPRITE_POSES.length} />
                 <button onClick={(e) => { e.stopPropagation(); handleOpenSpriteSheetModal(char); }} className="bg-teal-600/80 text-white p-1 rounded-full hover:bg-teal-500 transition" aria-label={`${char.params.name}のスプライトシートを生成`}>
                   <SpriteSheetIcon />
                 </button>
              </div>
          )}
        </div>
      ))}
    </div>
  );

  const TimelineRuler = ({ duration }: { duration: number }) => {
      const markers = Array.from({ length: duration + 1 }, (_, i) => i);
      return (
          <div className="relative h-6 w-full mt-2">
              <div className="h-px bg-gray-600 absolute top-2.5 left-0 w-full"></div>
              {markers.map(time => (
                  <div key={time} style={{ left: `${(time / duration) * 100}%` }} className="absolute -translate-x-1/2 text-xs text-gray-500 flex flex-col items-center h-full top-0">
                      <div className="w-px h-2 bg-gray-600"></div>
                      <span className="mt-1">{time}</span>
                  </div>
              ))}
          </div>
      );
  };
  
  const KeyframeEditorModal = () => {
    if (!editingKeyframeInfo) return null;

    const { character, keyframe } = editingKeyframeInfo;
    const isEditing = !!keyframe;

    const [time, setTime] = useState<number>(keyframe?.time ?? 0);
    const [pose, setPose] = useState(keyframe?.pose ?? '');
    const [expression, setExpression] = useState(keyframe?.expression ?? '');
    const [interpolation, setInterpolation] = useState<InterpolationType>(keyframe?.interpolation ?? 'linear');

    const handleCopy = () => {
      setCopiedKeyframe({ pose, expression, interpolation });
      showToast('✅ キーフレームの値をコピーしました');
    };
  
    const handlePaste = () => {
      if (copiedKeyframe) {
        setPose(copiedKeyframe.pose);
        setExpression(copiedKeyframe.expression);
        setInterpolation(copiedKeyframe.interpolation);
        showToast('📋 値を貼り付けました');
      }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const numericTime = Number(time);
      if (numericTime < 0 || numericTime > videoDuration) {
        alert(`時間は0から${videoDuration}秒の間で設定してください。`);
        return;
      }
      handleSaveKeyframe(character.id, { time: numericTime, pose, expression, interpolation }, keyframe?.id);
    };

    const handleDelete = () => {
        if (keyframe?.id && window.confirm('このキーフレームを削除しますか？')) {
            handleDeleteKeyframe(character.id, keyframe.id);
        }
    };
    
    const handleDuplicate = () => {
      if (keyframe?.id) {
          handleDuplicateKeyframe(character.id, keyframe);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 fade-in">
        <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? 'キーフレーム編集' : 'キーフレーム追加'}: <span className="text-indigo-400">{character.params.name}</span>
          </h2>

          <form id="keyframe-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="kf-time" className="block text-sm font-medium text-gray-400 mb-1">
                時間 (秒): <span className="font-bold text-indigo-400">{time.toFixed(1)}</span>
              </label>
              <input
                id="kf-time"
                type="range"
                min="0"
                max={videoDuration}
                step="0.1"
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label htmlFor="kf-pose" className="block text-sm font-medium text-gray-400 mb-1">ポーズ</label>
              <select id="kf-pose" value={pose} onChange={(e) => setPose(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                {Object.keys(PARAMETERS.pose.choices).map(choice => (
                  <option key={choice} value={choice}>{choice}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="kf-expression" className="block text-sm font-medium text-gray-400 mb-1">表情</label>
              <select id="kf-expression" value={expression} onChange={(e) => setExpression(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                 {Object.keys(PARAMETERS.expression.choices).map(choice => (
                  <option key={choice} value={choice}>{choice}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">補間</label>
              <div className="flex items-end gap-4">
                <select id="kf-interpolation" value={interpolation} onChange={(e) => setInterpolation(e.target.value as InterpolationType)} className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md">
                   {Object.entries(INTERPOLATION_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <InterpolationPreview type={interpolation} />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-700/50">
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 text-sm bg-gray-700 text-white font-bold py-2 px-2 rounded-lg hover:bg-gray-600 transition flex items-center justify-center gap-2"
                    aria-label="現在のキーフレーム値をコピー"
                >
                    <CopyIcon small={true} /> 値をコピー
                </button>
                <button
                    type="button"
                    onClick={handlePaste}
                    disabled={!copiedKeyframe}
                    className="flex-1 text-sm bg-gray-700 text-white font-bold py-2 px-2 rounded-lg hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    aria-label="コピーしたキーフレーム値を貼り付け"
                >
                    <PasteIcon small={true} /> 値を貼り付け
                </button>
                 {isEditing && (
                    <button
                        type="button"
                        onClick={handleDuplicate}
                        className="flex-1 text-sm bg-gray-700 text-white font-bold py-2 px-2 rounded-lg hover:bg-gray-600 transition flex items-center justify-center gap-2"
                        aria-label="キーフレームを複製"
                    >
                       <SparklesIcon small={true} /> 複製
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition">
                {isEditing ? '更新' : '追加'}
              </button>
              <button type="button" onClick={() => setEditingKeyframeInfo(null)} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 transition">
                キャンセル
              </button>
            </div>
          </form>

          {isEditing && (
            <button onClick={handleDelete} className="w-full bg-red-600/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition mt-2 flex items-center justify-center gap-2">
              <TrashIcon /> このキーフレームを削除
            </button>
          )}

        </div>
      </div>
    );
  };

  const IntermediateKeyframeModal = () => {
    const [count, setCount] = useState(3);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleGenerateIntermediateFrames(count);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 fade-in">
            <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-sm flex flex-col gap-4">
                <h2 className="text-2xl font-bold text-white">中間キーフレームを生成</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="kf-count" className="block text-sm font-medium text-gray-400 mb-1">
                            生成するキーフレームの数: <span className="font-bold text-indigo-400">{count}</span>
                        </label>
                        <input
                            id="kf-count"
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <p className="text-xs text-gray-400">
                      タイミングは最初のキーフレームの「{INTERPOLATION_TYPES[getSelectedKeyframeInfo()?.kf1.interpolation || 'linear']}」補間に基づいて計算されます。
                    </p>
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setIsIntermediateModalOpen(false)} className="flex-1 bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 transition">
                            キャンセル
                        </button>
                        <button type="submit" className="flex-1 bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition">
                            生成
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
  };
  
  const isAnimationModeReady = !!(framerMode === 'animation' && startImage && animationPrompt);
  const isInterpolationModeReady = !!((framerMode === 'image' || framerMode === 'video') && startImage && endImage);
  const isVideoGenerationReady = !!(lyrics || prompt || characterSlots.length > 0);

  const selectedVideoModelInfo = VIDEO_GEN_MODELS[videoGenModel];
  const generateButtonText = isLoading 
      ? 'フル動画を生成中...' 
      : useGeminiApi && selectedVideoModelInfo.type === 'api'
        ? `フル動画を生成 (${selectedVideoModelInfo.name})`
        : `フル動画を生成 (${selectedVideoModelInfo.name} Sim)`;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {apiNotification && (
        <div className="fixed top-5 right-5 bg-red-600 text-white py-2 px-4 rounded-lg shadow-lg z-50 fade-in">
          {apiNotification}
        </div>
      )}
      <header className="w-full max-w-7xl mb-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
          AI Animation Studio
        </h1>
        <p className="mt-2 text-lg text-gray-400">創造力を解き放ち、アニメーションを生成しよう</p>
      </header>

      <div className="w-full max-w-7xl mb-8 flex justify-center border-b border-gray-700">
          <button onClick={() => setMainTab('animator')} className={`py-3 px-6 font-semibold text-lg rounded-t-lg transition-colors duration-200 ${mainTab === 'animator' ? 'bg-gray-800 text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              リリック・アニメーター
          </button>
          <button onClick={() => setMainTab('character')} className={`py-3 px-6 font-semibold text-lg rounded-t-lg transition-colors duration-200 ${mainTab === 'character' ? 'bg-gray-800 text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              キャラクター管理
          </button>
          <button onClick={() => setMainTab('framer')} className={`py-3 px-6 font-semibold text-lg rounded-t-lg transition-colors duration-200 ${mainTab === 'framer' ? 'bg-gray-800 text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              中間フレーム生成
          </button>
          <button onClick={() => setMainTab('settings')} className={`py-3 px-6 font-semibold text-lg rounded-t-lg transition-colors duration-200 ${mainTab === 'settings' ? 'bg-gray-800 text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              設定
          </button>
      </div>
      
      <main className="w-full max-w-7xl">
        {mainTab === 'animator' ? (
          <div className="fade-in grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Inputs */}
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
              {/* Lyrics and Storyboard */}
              <div>
                <div className="space-y-4">
                    <div>
                      <label htmlFor="main-lyrics" className="block text-sm font-medium text-gray-400 mb-1">
                        歌詞・シナリオ原文 (改行で分割)
                      </label>
                      <textarea
                        id="main-lyrics"
                        value={lyrics}
                        onChange={(e) => setLyrics(e.target.value)}
                        placeholder="ここに歌詞や大まかなシナリオを入力..."
                        className="w-full h-24 p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                      />
                      <div className="grid grid-cols-2 gap-2 mt-2">
                          <button
                              onClick={() => audioFileInputRef.current?.click()}
                              disabled={isTranscribing}
                              className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                              {isTranscribing ? (
                                  <div className="loader w-4 h-4 rounded-full border-2 border-gray-500"></div>
                              ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" /><path d="M5.5 4.5a2.5 2.5 0 015 0v6a2.5 2.5 0 01-5 0V4.5z" /><path d="M9 15a1 1 0 001 1h.01a1 1 0 100-2H10a1 1 0 00-1 1zM4 10.5a1 1 0 011.14-.993A6.002 6.002 0 0015 10c.553 0 1 .447 1 1s-.447 1-1 1a8.003 8.003 0 01-8.86-7.003A1 1 0 014 10.5z" /></svg>
                              )}
                              音声から読み込み
                          </button>
                          <button 
                              onClick={handleSplitLyricsIntoStoryboard}
                              className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                          >
                              <SparklesIcon small={true} /> 歌詞をボードに分割
                          </button>
                      </div>
                      <input type="file" accept="audio/*" onChange={handleFileChange} ref={audioFileInputRef} className="hidden" id="audio-upload" />
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-gray-200">ストーリーボード</h3>
                        <div className="overflow-x-auto bg-gray-900/50 p-2 rounded-lg">
                            <table className="w-full min-w-[800px] text-sm text-left">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                                    <tr>
                                        <th className="p-2 w-12 text-center">シーン</th>
                                        <th className="p-2 w-20">時間(s)</th>
                                        <th className="p-2 min-w-[150px]">ストーリー/歌詞</th>
                                        <th className="p-2 min-w-[200px]">シナリオ/演出</th>
                                        <th className="p-2 w-40">カメラアングル</th>
                                        <th className="p-2 min-w-[100px]">メモ</th>
                                        <th className="p-2 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {storyboardData.map((row) => (
                                        <tr key={row.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                                            <td className="p-1 text-center font-semibold">{row.scene}</td>
                                            <td className="p-1">
                                                <input type="number" value={row.time} onChange={(e) => handleStoryboardChange(row.id, 'time', Number(e.target.value))} className="w-full bg-gray-900 border border-gray-600 rounded p-1" step="0.1" />
                                            </td>
                                            <td className="p-1">
                                                <textarea value={row.story} onChange={(e) => handleStoryboardChange(row.id, 'story', e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-1 resize-y min-h-[40px] text-xs" rows={2}/>
                                            </td>
                                            <td className="p-1">
                                                <textarea value={row.scenario} onChange={(e) => handleStoryboardChange(row.id, 'scenario', e.target.value)} placeholder="キャラ名: アクション" className="w-full bg-gray-900 border border-gray-600 rounded p-1 resize-y min-h-[40px] text-xs" rows={2}/>
                                            </td>
                                            <td className="p-1">
                                                <select value={row.angle} onChange={(e) => handleStoryboardChange(row.id, 'angle', e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-1 text-xs">
                                                   {Object.keys(PARAMETERS.angle.choices).map(choice => <option key={choice} value={choice}>{choice}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-1">
                                                 <input type="text" value={row.notes} onChange={(e) => handleStoryboardChange(row.id, 'notes', e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-1 text-xs" />
                                            </td>
                                            <td className="p-1 text-center">
                                                <button onClick={() => handleDeleteStoryboardRow(row.id)} className="text-gray-500 hover:text-red-500 p-1"><TrashIcon /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <button onClick={handleAddStoryboardRow} className="text-sm bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition">
                                行を追加
                           </button>
                           <button onClick={handleApplyStoryboardToTimeline} className="text-sm bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition">
                                タイムラインに反映
                           </button>
                           <input type="file" accept=".csv" onChange={handleLoadStoryboardFromCSV} className="hidden" id="csv-upload" ref={csvInputRef} />
                           <button onClick={() => csvInputRef.current?.click()} className="text-sm bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition">
                               LOAD (CSV)
                           </button>
                           <button onClick={handleSaveStoryboardAsCSV} className="text-sm bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition">
                               SAVE (CSV)
                           </button>
                        </div>
                    </div>
                  </div>
              </div>
              <div className="flex flex-col gap-4">
                 <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="プロンプト (ストーリーボードから自動生成されます)" className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" aria-label="プロンプト" />
                <input type="text" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="ネガティブプロンプト (例: 低品質, ぼやけている)" className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" aria-label="ネガティブプロンプト" />
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">動画生成モデル</label>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 rounded-lg bg-gray-900 p-1">
                      {Object.entries(VIDEO_GEN_MODELS).map(([key, model]) => (
                        <button
                          key={key}
                          onClick={() => setVideoGenModel(key as VideoGenModel)}
                          className={`w-full py-2 px-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 ${
                            videoGenModel === key
                              ? 'bg-indigo-600 text-white shadow'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {model.name}
                          {model.type === 'sim' && <span className="text-xs text-gray-400 ml-1">(Sim)</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="animation-style" className="block text-sm font-medium text-gray-400 mb-1">アニメーションスタイル</label>
                      <select
                        id="animation-style"
                        value={animationStyle}
                        onChange={(e) => setAnimationStyle(e.target.value)}
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        aria-label="アニメーションスタイル選択"
                      >
                        <option value="auto">自動</option>
                        <option value="fade-in">フェードイン</option>
                        <option value="slide-in">スライドイン</option>
                        <option value="zoom">ズーム</option>
                      </select>
                    </div>
                     <AspectRatioSelector value={videoAspectRatio} onChange={setVideoAspectRatio} labelId="video-aspect-ratio" label="動画アスペクト比" />
                  </div>
                </div>
                <div>
                  <label htmlFor="video-duration" className="block text-sm font-medium text-gray-400 mb-1">
                    ビデオの長さ: <span className="font-bold text-indigo-400">{videoDuration}秒</span>
                  </label>
                  <input
                    type="range"
                    id="video-duration"
                    min="1"
                    max="30"
                    value={videoDuration}
                    onChange={(e) => setVideoDuration(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    aria-label="ビデオの長さ設定"
                  />
                </div>
              </div>

              {/* Character Animation Timeline */}
              <div className="bg-gray-900/50 p-4 rounded-lg flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">アニメーション・タイムライン ({characterSlots.length}/{MAX_CHARACTERS_IN_SCENE})</h3>
                     <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button onClick={handleGroup} disabled={selectedKeyframesCount < 2} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm" title="選択をグループ化 (Cmd/Ctrl+G)"><GroupIcon /></button>
                        <button onClick={handleUngroup} disabled={!isAnySelectedInGroup} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm" title="グループ解除 (Cmd/Ctrl+Shift+G)"><UngroupIcon /></button>
                        <button onClick={handleCopy} disabled={selectedKeyframesCount === 0} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm" title="選択をコピー (Cmd/Ctrl+C)"><CopyIcon /></button>
                        <button onClick={handlePaste} disabled={!clipboard} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm" title="貼り付け (Cmd/Ctrl+V)"><PasteIcon /></button>
                        <button onClick={() => setIsIntermediateModalOpen(true)} disabled={!getSelectedKeyframeInfo()} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm" title="中間キーフレームを生成"><SparklesIcon /></button>
                        <button onClick={handleTimelineUndo} disabled={timelineHistoryIndex === 0} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed" aria-label="元に戻す" title="元に戻す (Cmd/Ctrl+Z)"><UndoIcon /></button>
                        <button onClick={handleTimelineRedo} disabled={timelineHistoryIndex >= timelineHistory.length - 1} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed" aria-label="やり直す" title="やり直す (Cmd/Ctrl+Shift+Z or Y)"><RedoIcon /></button>
                        <div className="flex items-center gap-1 bg-gray-700 rounded-md p-1">
                            <button onClick={handleZoomOut} disabled={zoomLevel <= 0.25} className="px-2 disabled:opacity-50 font-bold" title="ズームアウト (Cmd/Ctrl+-)">-</button>
                            <span className="text-xs w-12 text-center select-none">{Math.round(zoomLevel * 100)}%</span>
                            <button onClick={handleZoomIn} disabled={zoomLevel >= 8} className="px-2 disabled:opacity-50 font-bold" title="ズームイン (Cmd/Ctrl+=)">+</button>
                        </div>
                    </div>
                  </div>
                  <div
                    ref={timelineContainerRef}
                    className="w-full overflow-hidden cursor-grab active:cursor-grabbing bg-gray-900/50 p-2 rounded"
                    onWheel={handleTimelineWheel}
                    onMouseDown={handleTimelineMouseDown}
                    onMouseMove={handleTimelineMouseMove}
                    onMouseUp={handleTimelineMouseUp}
                    onMouseLeave={handleTimelineMouseUp}
                  >
                    <div
                      style={{
                        width: `${100 * zoomLevel}%`,
                        transform: `translateX(-${timelineScrollLeft}px)`,
                        minWidth: '100%'
                      }}
                      className="relative"
                    >
                        <TimelineRuler duration={videoDuration} />
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 mt-2">
                            {characterSlots.map((char) => {
                                const charKeyframes = animationTimeline[char.id] || [];
                                return (
                                <div key={char.id} className="bg-gray-800/80 p-2 rounded-lg flex items-center gap-3">
                                    <img src={char.params.imageUrl} alt={char.params.name} className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-center">
                                            <p className="font-bold text-sm text-white truncate">{char.params.name}</p>
                                            <button onClick={() => handleRemoveFromTimeline(char.id)} className="text-gray-400 hover:text-red-500 transition">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                            </button>
                                        </div>
                                        <div 
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleKeyframeDrop(e, char.id)}
                                            className="relative w-full h-8 bg-gray-700 rounded-full mt-1 timeline-track"
                                        >
                                           {keyframeGroups.map(group => {
                                                const kfsInGroupForChar = group.keyframeRefs
                                                    .filter(ref => ref.characterId === char.id)
                                                    .map(ref => charKeyframes.find(kf => kf.id === ref.keyframeId))
                                                    .filter((kf): kf is Keyframe => !!kf);

                                                if (kfsInGroupForChar.length < 2) return null;
                                                
                                                const isGroupSelected = group.keyframeRefs.some(ref => 
                                                    (selectedKeyframes[ref.characterId] || []).includes(ref.keyframeId)
                                                );

                                                const times = kfsInGroupForChar.map(kf => kf.time);
                                                const minTime = Math.min(...times);
                                                const maxTime = Math.max(...times);
                                                
                                                const left = (minTime / videoDuration) * 100;
                                                const width = ((maxTime - minTime) / videoDuration) * 100;

                                                return (
                                                    <div
                                                        key={group.id}
                                                        className={`absolute top-1/2 -translate-y-1/2 h-2 rounded-full group-bar ${highlightedGroupId === group.id ? 'highlighted' : ''} ${isGroupSelected ? 'selected-group' : ''}`}
                                                        style={{ left: `${left}%`, width: `${width}%`, backgroundColor: group.color, color: group.color, opacity: 0.5 }}
                                                        onMouseEnter={() => setHighlightedGroupId(group.id)}
                                                        onMouseLeave={() => setHighlightedGroupId(null)}
                                                    />
                                                );
                                           })}
                                            {charKeyframes.map(kf => {
                                                const isSelected = (selectedKeyframes[char.id] || []).includes(kf.id);
                                                const group = getGroupForKeyframe(char.id, kf.id);
                                                const isHighlighted = group?.id === highlightedGroupId;

                                                return (
                                                <div 
                                                    key={kf.id}
                                                    style={{ left: `${(kf.time / videoDuration) * 100}%`, zIndex: isSelected ? 10 : 1 }} 
                                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center group"
                                                    onMouseEnter={() => group && setHighlightedGroupId(group.id)}
                                                    onMouseLeave={() => group && setHighlightedGroupId(null)}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleKeyframeSelection(char.id, kf.id)}
                                                        className="absolute -left-2 top-1/2 -translate-y-1/2 accent-indigo-500 transition-opacity cursor-pointer w-4 h-4"
                                                        style={{ opacity: isSelected ? 1 : 0 }}
                                                    />
                                                    <button 
                                                        draggable={true}
                                                        onDragStart={(e) => handleKeyframeDragStart(e, char.id, kf.id)}
                                                        onDragEnd={handleKeyframeDragEnd}
                                                        onClick={() => setEditingKeyframeInfo({ character: char, keyframe: kf })}
                                                        className={`w-4 h-4 transform transition-all duration-200 ${isHighlighted ? 'scale-150' : 'hover:scale-150'} ${draggingKeyframe?.keyframeId === kf.id ? 'cursor-grabbing opacity-50' : 'cursor-grab'} ${isSelected ? 'scale-150 ring-2 ring-indigo-400 rounded-sm' : ''}`}
                                                        aria-label={`キーフレーム編集 ${kf.time}秒`}
                                                    >
                                                        <svg viewBox="0 0 10 10" className={`w-full h-full ${isSelected ? 'text-indigo-400' : isHighlighted ? 'text-white' : 'text-amber-400'} fill-current`}><polygon points="5,0 10,5 5,10 0,5"/></svg>
                                                    </button>
                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                                                        <p>時間: {kf.time}s</p>
                                                        <p>ポーズ: {kf.pose}</p>
                                                        <p>表情: {kf.expression}</p>
                                                        <p>補間: {INTERPOLATION_TYPES[kf.interpolation] || '線形'}</p>
                                                        {group && <p style={{color: group.color}}>グループ: {group.name}</p>}
                                                    </div>
                                                </div>
                                            )})}
                                        </div>
                                    </div>
                                    <button onClick={() => setEditingKeyframeInfo({ character: char })} className="bg-indigo-600 text-white px-2 py-1 text-xs rounded-md hover:bg-indigo-700 transition flex-shrink-0">
                                        + キーフレーム
                                    </button>
                                </div>
                            )})}
                        </div>
                    </div>
                  </div>
                  <div onDrop={handleDropOnTimeline} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className="mt-2 p-4 text-center border-2 border-dashed border-gray-700 rounded-lg text-gray-500 transition hover:border-indigo-500 hover:text-indigo-400">
                      キャラクターをここにドラッグ&ドロップ (最大{MAX_CHARACTERS_IN_SCENE}人)
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mt-4 mb-2">作成済みキャラクター (ドラッグ用)</h3>
                    <CharacterList isDraggable={true} />
                  </div>
              </div>

              <div className="flex gap-4 mt-auto pt-6 border-t border-gray-700/50">
                <button onClick={handleGeneratePreview} disabled={isLoading || isPreviewLoading || !isVideoGenerationReady} className="flex-1 bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-500 transition transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">
                    {isPreviewLoading ? 'プレビュー生成中...' : 'プレビュー生成'}
                </button>
                <div className="flex-1 flex items-center justify-center gap-2">
                  <button onClick={handleGenerateVideo} disabled={isLoading || isPreviewLoading || !isVideoGenerationReady} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-indigo-700 transition transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100" aria-label="フル動画を生成">
                    {generateButtonText}
                  </button>
                  <QuotaCostIndicator type="video" amount={1} isApplicable={isVideoGenerationReady && selectedVideoModelInfo.type === 'api'} />
                </div>
              </div>

            </div>

            {/* Right Column: Output & History */}
            <div className="flex flex-col gap-8">
              <div className={`bg-gray-800 p-6 rounded-2xl shadow-lg ${getAspectRatioClass(videoAspectRatio)} flex items-center justify-center relative`}>
                {isLoading || isPreviewLoading ? (
                  <div className="fade-in text-center">
                    <div className="loader w-12 h-12 rounded-full border-4 border-gray-700 mx-auto mb-4"></div>
                    <p className="text-lg font-semibold">{loadingMessage}</p>
                  </div>
                ) : generatedVideoUrl ? (
                  <>
                    <video src={generatedVideoUrl} controls className="w-full h-full rounded-lg" aria-label="生成された動画"></video>
                    <button onClick={handleDownloadVideo} className="absolute top-4 right-4 bg-gray-900/70 text-white p-2 rounded-full hover:bg-gray-800/90 transition-all transform hover:scale-110" aria-label="動画をダウンロード">
                        <DownloadIcon />
                    </button>
                  </>
                ) : generatedPreviewUrl ? (
                    <>
                        <video src={generatedPreviewUrl} controls className="w-full h-full rounded-lg" aria-label="生成されたプレビュー動画"></video>
                        <div className="absolute top-4 left-4 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                            プレビュー
                        </div>
                    </>
                ) : (
                  <div className="text-center text-gray-500">
                    <p>ここに動画が生成されます</p>
                  </div>
                )}
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex-1">
                <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">履歴</h2>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {history.length > 0 ? history.map((item, index) => (
                    <div key={item.id} className="history-item bg-gray-900 p-4 rounded-lg flex justify-between items-center gap-4">
                      <div className="flex-1 overflow-hidden text-sm text-gray-400 space-y-1">
                        <p className="truncate"><strong>{item.inputType === 'storyboard' ? 'ストーリー' : '歌詞'}:</strong> {item.lyrics}</p>
                        <p className="truncate"><strong>プロンプト:</strong> {item.prompt || 'なし'}</p>
                        {item.videoGenModel && VIDEO_GEN_MODELS[item.videoGenModel] && (
                            <div className="flex items-center gap-2">
                                <p className="truncate flex-shrink-0"><strong>モデル:</strong></p>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${VIDEO_GEN_MODELS[item.videoGenModel].tagColor}`}>
                                    {VIDEO_GEN_MODELS[item.videoGenModel].name}
                                </span>
                            </div>
                        )}
                        <p className="truncate"><strong>比率:</strong> {item.aspectRatio || '1:1'}</p>
                        <p className="truncate"><strong>長さ:</strong> {item.videoDuration || 8}秒</p>
                        <p className="truncate"><strong>キャラ:</strong> {item.characterSlotIds.map(id => characters.find(c=>c.id === id)?.params.name).filter(Boolean).join(', ') || 'なし'}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => reuseHistory(item)} className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition text-sm transform hover:scale-105 active:scale-95" aria-label={`履歴${index + 1}を再利用`}>再利用</button>
                        <button onClick={() => deleteHistory(item.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition text-sm transform hover:scale-105 active:scale-95" aria-label={`履歴${index + 1}を削除`}>削除</button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center py-4">まだ履歴がありません</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : mainTab === 'character' ? (
          <div className="fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Character Editor */}
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col gap-4">
              <h2 className="text-2xl font-bold">{editingCharacter ? `キャラクター編集: ${editingCharacter.params.name}` : `キャラクター作成 (${(Array.isArray(characters) ? characters.length : 0)}/10)`}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[60vh] pr-2">
                  <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-400 mb-1">キャラクター画像 (PNG推奨)</label>
                      <div className={`w-full ${getAspectRatioClass(charAspectRatio)} bg-gray-900 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center relative`}>
                          <input type="file" accept="image/*" onChange={handleCharImageUpload} className="hidden" id="char-image-upload" />
                          <label htmlFor="char-image-upload" className="group cursor-pointer w-full h-full flex items-center justify-center">
                              {charParams.imageUrl ? (
                                  <img src={charParams.imageUrl} alt={charParams.name || 'キャラクタープレビュー'} className="w-full h-full object-contain rounded-lg p-1" />
                              ) : (
                                  <div className="text-center text-gray-500 transition-transform group-hover:scale-105">
                                      <UploadIcon />
                                      <p className="mt-1 text-xs">画像をアップロード (任意)</p>
                                      <p className="mt-1 text-xs text-gray-600">
                                          {useGeminiApi ? 'ない場合はAIが生成します' : 'ない場合はプレースホルダーを生成'}
                                      </p>
                                  </div>
                              )}
                          </label>
                          {charParams.imageUrl && (
                              <label htmlFor="char-image-upload" className="absolute bottom-2 right-2 bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition cursor-pointer transform hover:scale-110" aria-label="画像を編集">
                                  <EditIcon />
                              </label>
                          )}
                      </div>
                      <div className="mt-2">
                        <label htmlFor="char-image-url" className="block text-sm font-medium text-gray-400 mb-1">または 画像URL</label>
                        <input
                          type="text"
                          id="char-image-url"
                          value={charParams.imageUrl || ''}
                          onChange={(e) => handleCharParamChange('imageUrl', e.target.value)}
                          placeholder="画像のURLを直接入力または編集"
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-xs"
                        />
                      </div>
                  </div>
                   <div className="sm:col-span-1 flex flex-col gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">キャラクター名</label>
                          <input type="text" value={charParams.name} onChange={(e) => handleCharParamChange('name', e.target.value)} placeholder="必須" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" />
                        </div>
                         <AspectRatioSelector value={charAspectRatio} onChange={setCharAspectRatio} labelId="char-aspect-ratio" label="画像アスペクト比" />
                         <ModelSelector value={imageGenModel} onChange={setImageGenModel} options={IMAGE_GEN_MODELS} labelId="image-gen-model-char" label="画像生成モデル" />
                  </div>
                  
                  {(isAnalyzingImage || analysisSuggestions) && (
                      <div className="sm:col-span-2">
                          <h3 className="text-lg font-bold text-gray-300 mb-2">画像解析によるAI提案</h3>
                          <div className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-sm space-y-4">
                              {isAnalyzingImage ? (
                                  <div className="flex items-center justify-center h-full py-10">
                                      <div className="loader w-6 h-6 rounded-full border-2 border-gray-700 mr-3"></div>
                                      <p className="text-gray-400">
                                          {useGeminiApi ? 'PNG画像を解析し、プロンプトを提案しています...' : '画像解析をシミュレートしています...'}
                                      </p>
                                  </div>
                              ) : analysisSuggestions && (
                                  <>
                                      <div>
                                          <label className="block text-sm font-medium text-gray-400 mb-1">提案タグ</label>
                                          <p className="text-gray-300 whitespace-pre-wrap text-xs bg-gray-800 p-2 rounded">{analysisSuggestions.tags}</p>
                                          {analysisSuggestions.tags && !analysisSuggestions.tags.startsWith("解析エラー") && (
                                            <button 
                                                onClick={() => {
                                                    const currentDesc = charParams.description || '';
                                                    const newDesc = [currentDesc, analysisSuggestions.tags.replace('シミュレーションモード: ', '')].filter(Boolean).join(', ');
                                                    handleCharParamChange('description', newDesc);
                                                }}
                                                className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition mt-2"
                                            >
                                                「その他の特徴」に追加
                                            </button>
                                          )}
                                      </div>
                                      
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          <div>
                                              <label className="block text-sm font-medium text-gray-400 mb-1">提案 Positive Prompt</label>
                                              <textarea readOnly value={analysisSuggestions.positivePrompt} className="w-full h-24 p-2 text-xs bg-gray-800 border border-gray-600 rounded-md resize-none" />
                                          </div>
                                          <div>
                                              <label className="block text-sm font-medium text-gray-400 mb-1">提案 Negative Prompt</label>
                                              <textarea readOnly value={analysisSuggestions.negativePrompt} className="w-full h-24 p-2 text-xs bg-gray-800 border border-gray-600 rounded-md resize-none" />
                                          </div>
                                      </div>

                                      {analysisSuggestions.positivePrompt && !analysisSuggestions.positivePrompt.startsWith("解析エラー") && (
                                        <button 
                                          onClick={() => {
                                            setGeneratedPositivePrompt(analysisSuggestions.positivePrompt.replace('シミュレーションモード: ', ''));
                                            setGeneratedNegativePrompt(analysisSuggestions.negativePrompt.replace('シミュレーションモード: ', ''));
                                          }}
                                          className="w-full text-sm bg-teal-600 text-white px-3 py-2 rounded hover:bg-teal-700 transition"
                                        >
                                          提案されたプロンプトを使用する
                                        </button>
                                      )}
                                  </>
                              )}
                          </div>
                      </div>
                  )}

                  {Object.entries(PARAMETERS).map(([key, param]) => {
                      if (key === 'description') return null; // Textarea is rendered separately
                      const value = charParams[key as keyof CharacterParams] ?? (param.type === 'checkboxgroup' ? [] : '');
                      
                      switch (param.type) {
                          case 'radio':
                              return <div key={key}>
                                  <label className="block text-sm font-medium text-gray-400 mb-2">{param.label}</label>
                                  <div className="flex gap-x-4">
                                      {Object.keys(param.choices).map(choice => (
                                          <label key={choice} className="flex items-center text-sm"><input type="radio" name={key} value={choice} checked={value === choice} onChange={(e) => handleCharParamChange(key, e.target.value)} className="mr-1 accent-indigo-500"/>{choice}</label>
                                      ))}
                                  </div>
                              </div>;
                          case 'slider':
                              return <div key={key} className="sm:col-span-1">
                                  <label className="block text-sm font-medium text-gray-400 mb-1">{param.label}: <span className="font-bold text-indigo-400">{value as number}</span></label>
                                  <input
                                      type="range"
                                      min={param.min}
                                      max={param.max}
                                      value={value as number}
                                      onChange={(e) => handleCharParamChange(key, Number(e.target.value))}
                                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                  />
                              </div>;
                          case 'checkboxgroup':
                              const currentValues = (Array.isArray(value) ? value : []) as string[];
                              return <div key={key} className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-400 mb-2">{param.label}</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {Object.keys(param.choices).map(choice => (
                                        <label key={choice} className="flex items-center text-sm p-2 bg-gray-700 rounded-md"><input type="checkbox" value={choice} checked={currentValues.includes(choice)} onChange={(e) => { const newValues = e.target.checked ? [...currentValues, choice] : currentValues.filter(v => v !== choice); handleCharParamChange(key, newValues); }} className="mr-2 accent-indigo-500"/>{choice}</label>
                                    ))}
                                </div>
                              </div>;
                          case 'nested-dropdown':
                              if (key !== 'background') return null;
                              const bgParam = param;
                              const customBgCategory = "カスタム";

                              const allCategories: Record<string, Record<string, string>> = { ...bgParam.categories };
                              if (customBackgrounds.length > 0) {
                                  allCategories[customBgCategory] = Object.fromEntries(customBackgrounds.map(bg => [bg.name, bg.prompt]));
                              }

                              const currentChoices = allCategories[selectedBgCategory] || allCategories['選択なし'];

                              return (
                                  <div key={key} className="sm:col-span-2 space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                          <div>
                                              <label className="block text-sm font-medium text-gray-400 mb-1">{param.label} カテゴリ</label>
                                              <select
                                                  value={selectedBgCategory}
                                                  onChange={(e) => {
                                                      const newCategory = e.target.value;
                                                      setSelectedBgCategory(newCategory);
                                                      const firstChoice = Object.keys(allCategories[newCategory])[0] || '選択なし';
                                                      handleCharParamChange(key, firstChoice);
                                                  }}
                                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                                              >
                                                  {Object.keys(allCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                              </select>
                                          </div>
                                          <div>
                                              <label className="block text-sm font-medium text-gray-400 mb-1">{param.label} 詳細</label>
                                              <select
                                                  value={value as string}
                                                  onChange={(e) => handleCharParamChange(key, e.target.value)}
                                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                                                  disabled={selectedBgCategory === '選択なし'}
                                              >
                                                  {Object.keys(currentChoices).map(choice => <option key={choice} value={choice}>{choice}</option>)}
                                              </select>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                         <button type="button" onClick={() => { setIsBgModalOpen(true); setBgPrompt(''); setGeneratedBgUrl(null); }} className="w-full text-sm bg-indigo-600 text-white px-2 py-2 rounded hover:bg-indigo-700 transition">
                                             カスタム背景を生成
                                         </button>
                                         <QuotaCostIndicator type="image" amount={1} />
                                      </div>
                                  </div>
                              );
                          case 'dropdown':
                               const choices = param.choices;
                               return <div key={key}>
                                   <label className="block text-sm font-medium text-gray-400 mb-1 flex justify-between items-center">
                                       {param.label}
                                   </label>
                                   <select value={value as string} onChange={(e) => handleCharParamChange(key, e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                                       {Object.keys(choices).map(choice => (<option key={choice} value={choice}>{choice}</option>))}
                                   </select>
                               </div>
                          case 'color':
                              return <div key={key}>
                                  <label className="block text-sm font-medium text-gray-400 mb-1">{param.label}</label>
                                  <input type="color" value={value} onChange={(e) => handleCharParamChange(key, e.target.value)} className="w-full h-9 p-0 bg-gray-700 border border-gray-600 rounded-md cursor-pointer"/>
                              </div>
                          default: return null;
                      }
                  })}
                  <div key="description" className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-400 mb-1">{PARAMETERS.description.label}</label>
                      <textarea value={charParams.description} onChange={(e) => handleCharParamChange('description', e.target.value)} placeholder={PARAMETERS.description.placeholder} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md h-20 resize-none"/>
                  </div>
              </div>
              <div className="flex gap-4 mt-auto">
                <div className="flex-1 flex items-center gap-2">
                  <button onClick={handleSaveCharacter} disabled={isCreatingChar || (!editingCharacter && (Array.isArray(characters) ? characters.length : 0) >= 10)} className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105">
                    {isCreatingChar ? '保存中...' : (editingCharacter ? 'キャラクターを更新' : 'キャラクターを保存')}
                  </button>
                  <QuotaCostIndicator type="image" amount={1} isApplicable={!charParams.imageUrl} />
                </div>
                {editingCharacter && (
                    <button onClick={handleCancelEditing} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 transition">
                        キャンセル
                    </button>
                )}
              </div>
            </div>
            
            {/* Character List & Management */}
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col gap-4">
              <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">キャラクター一覧</h2>
                  <div className="flex gap-2">
                      <input type="file" accept=".json" onChange={handleLoadCharactersFromFile} className="hidden" id="char-file-upload" ref={characterFileInputRef} />
                      <button onClick={() => characterFileInputRef.current?.click()} className="bg-gray-700 text-white px-3 py-2 rounded-md hover:bg-gray-600 transition text-sm flex items-center gap-1"><LoadIcon /> 読込</button>
                      <button onClick={handleSaveCharactersToFile} className="bg-gray-700 text-white px-3 py-2 rounded-md hover:bg-gray-600 transition text-sm flex items-center gap-1"><SaveIcon /> 保存</button>
                  </div>
              </div>
              <CharacterList isDraggable={false} />
            </div>
          </div>
        ) : mainTab === 'framer' ? (
          <div className="fade-in grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Left Column: Input */}
            <div className="lg:col-span-1 bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
                <h2 className="text-2xl font-bold">入力設定</h2>
                
                {/* Mode Selector */}
                <div className="flex bg-gray-900 rounded-lg p-1">
                    <button onClick={() => setFramerMode('image')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${framerMode === 'image' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>画像補間</button>
                    <button onClick={() => setFramerMode('video')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${framerMode === 'video' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>動画補間</button>
                    <button onClick={() => setFramerMode('animation')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${framerMode === 'animation' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>画像アニメ化</button>
                </div>

                {/* Inputs based on mode */}
                { (framerMode === 'image' || framerMode === 'animation') && 
                    <ImageUploadBox image={startImage} onImageUpload={(e) => handleImageUpload(e, setStartImage)} title="開始画像" inputId="start-image-upload" aspectRatio={framerAspectRatio} />
                }
                { framerMode === 'video' && (
                    <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col items-center gap-4">
                      <h2 className="text-xl font-bold text-gray-300">動画アップロード</h2>
                      <div className={`w-full ${getAspectRatioClass(framerAspectRatio)} bg-gray-900 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center relative`}>
                        <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" id="video-upload-framer" />
                        <label htmlFor="video-upload-framer" className="group cursor-pointer w-full h-full flex items-center justify-center">
                           { isProcessingVideo ? (
                              <div className="text-center text-gray-500">
                                <div className="loader w-8 h-8 rounded-full border-2 border-gray-700 mx-auto mb-2"></div>
                                <p>動画を処理中...</p>
                              </div>
                           ) : startImage ? (
                              <img src={startImage} alt="動画の最終フレーム" className="w-full h-full object-contain rounded-lg p-2" />
                           ) : (
                              <div className="text-center text-gray-500 transition-transform group-hover:scale-105">
                                  <VideoIcon />
                                  <p>動画を選択</p>
                              </div>
                           )}
                        </label>
                         {startImage && (
                          <label htmlFor="video-upload-framer" className="absolute bottom-2 right-2 bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition cursor-pointer transform hover:scale-110" aria-label="動画を再アップロード">
                            <EditIcon />
                          </label>
                        )}
                      </div>
                      {startImage && <p className="text-xs text-gray-400">動画の最終フレームが開始画像として設定されました。</p>}
                    </div>
                )}

                { (framerMode === 'image' || framerMode === 'video') &&
                    <>
                        <div className="flex bg-gray-900 rounded-lg p-1">
                            <button onClick={() => setEndImageMode('upload')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${endImageMode === 'upload' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>アップロード</button>
                            <button onClick={() => setEndImageMode('generate')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${endImageMode === 'generate' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>AIで生成</button>
                        </div>
                        { endImageMode === 'upload' ? (
                            <ImageUploadBox image={endImage} onImageUpload={(e) => handleImageUpload(e, setEndImage)} title="終了画像" inputId="end-image-upload" aspectRatio={framerAspectRatio} />
                        ) : (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-300">終了画像 (AI生成)</h2>
                                <textarea
                                    value={endImagePrompt}
                                    onChange={(e) => setEndImagePrompt(e.target.value)}
                                    placeholder="開始画像からの変更点をプロンプトで指示 (例: add a futuristic city in the background)"
                                    className="w-full h-24 p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                      onClick={handleGenerateEndImageFromPrompt}
                                      disabled={isGeneratingEndImage || !startImage}
                                      className="flex-1 bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
                                  >
                                      {isGeneratingEndImage ? '生成中...' : '終了画像を生成'}
                                  </button>
                                  <QuotaCostIndicator type="image" amount={1} isApplicable={!!startImage} />
                                </div>
                                {endImage && (
                                    <div className="relative">
                                        <img src={endImage} alt="生成された終了画像" className={`w-full ${getAspectRatioClass(framerAspectRatio)} object-contain rounded-lg p-1 bg-gray-900`} />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                }

                { framerMode === 'animation' && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-300">アニメーション指示</h2>
                        <textarea
                            value={animationPrompt}
                            onChange={(e) => setAnimationPrompt(e.target.value)}
                            placeholder="開始画像に対するアニメーションの指示 (例: camera slowly zooms in, character blinks)"
                            className="w-full h-24 p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        />
                    </div>
                )}


                <div className="border-t border-gray-700 pt-4 space-y-4">
                    <h3 className="text-xl font-bold">設定</h3>
                    <div>
                      <label htmlFor="frame-count" className="block text-sm font-medium text-gray-400 mb-1">
                        中間フレーム数: <span className="font-bold text-indigo-400">{frameCount}</span>
                      </label>
                      <input
                        type="range"
                        id="frame-count"
                        min="2"
                        max="30"
                        value={frameCount}
                        onChange={(e) => setFrameCount(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <AspectRatioSelector value={framerAspectRatio} onChange={setFramerAspectRatio} labelId="framer-aspect-ratio" />
                </div>
                
                <div className="mt-auto pt-4 border-t border-gray-700">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={framerMode === 'animation' ? handleGenerateAnimationFromImage : handleGenerateFrames}
                        disabled={isGeneratingFrames || (framerMode === 'animation' && !isAnimationModeReady) || ((framerMode === 'image' || framerMode === 'video') && !isInterpolationModeReady)}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-indigo-700 transition transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGeneratingFrames ? '生成中...' : (framerMode === 'animation' ? 'アニメーション生成' : '中間フレーム生成')}
                      </button>
                      <QuotaCostIndicator type="video" amount={1} isApplicable={isAnimationModeReady} />
                    </div>
                    {framerMode === 'animation' && <p className="text-xs text-gray-500 mt-2 text-center">注意: アニメーション生成は数分かかる場合があります。</p>}
                </div>
            </div>

            {/* Right Column: Output */}
            <div className="lg:col-span-2 bg-gray-800 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold mb-4">生成結果</h2>
                 {(isGeneratingFrames || isGeneratingEndImage) && (
                  <div className="fade-in text-center py-10">
                    <div className="loader w-12 h-12 rounded-full border-4 border-gray-700 mx-auto mb-4"></div>
                    <p className="text-lg font-semibold">{loadingMessage || '生成中...'}</p>
                  </div>
                )}
                
                {generatedFrames.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {generatedFrames.map((frame, index) => (
                            <div key={index} className="relative group">
                                <img src={frame} alt={`Frame ${index + 1}`} className="w-full aspect-square object-cover rounded-lg" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button onClick={() => handleDownloadFrame(frame, index)} className="text-white p-2 bg-gray-900/70 rounded-full hover:scale-110 transition-transform">
                                        <DownloadIcon />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : !isGeneratingFrames && !isGeneratingEndImage && (
                    <div className="text-center text-gray-500 py-10">
                        <p>ここに中間フレームまたはアニメーションが表示されます</p>
                    </div>
                )}
            </div>

            {/* AI Toolkit Section */}
            <div className="lg:col-span-3 bg-gray-800 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold mb-4">AIツールキット</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Inspector */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-indigo-400">プロンプト・インスペクター</h3>
                        <ImageUploadBox
                          image={inspectorImage}
                          onImageUpload={(e) => handleImageUpload(e, setInspectorImage)}
                          inputId="inspector-image-upload"
                          aspectRatio="1:1"
                          small={true}
                        />
                        <div className="flex items-center gap-2">
                           <button onClick={handleInspectImage} disabled={isInspectingImage || !inspectorImage} className="flex-1 bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition disabled:opacity-50">
                               {isInspectingImage ? '解析中...' : '画像を解析'}
                           </button>
                           <QuotaCostIndicator type="image" amount={1} isApplicable={!!inspectorImage} />
                        </div>
                        <textarea
                            readOnly
                            value={inspectorPrompt}
                            placeholder="ここに解析されたプロンプトが表示されます"
                            className="w-full h-32 p-3 bg-gray-900 border border-gray-700 rounded-lg transition"
                        />
                        {inspectorPrompt && <button onClick={() => copyToClipboard(inspectorPrompt, 'プロンプト')} className="w-full bg-indigo-600/50 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-600/70 transition">プロンプトをコピー</button>}
                    </div>

                    {/* Painter */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-teal-400">AIペインター</h3>
                        <textarea
                            value={painterPrompt}
                            onChange={(e) => setPainterPrompt(e.target.value)}
                            placeholder="生成したい画像の詳細なプロンプトを入力..."
                            className="w-full h-32 p-3 bg-gray-900 border border-gray-700 rounded-lg transition"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <AspectRatioSelector value={painterAspectRatio} onChange={setPainterAspectRatio} labelId="painter-aspect-ratio" />
                            <ModelSelector value={painterModel} onChange={setPainterModel} options={IMAGE_GEN_MODELS} labelId="image-gen-model-painter" label="画像生成モデル" />
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handlePaintImage} disabled={isPaintingImage || !painterPrompt} className="flex-1 bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition disabled:opacity-50">
                                {isPaintingImage ? '生成中...' : '画像を生成'}
                            </button>
                            <QuotaCostIndicator type="image" amount={1} isApplicable={!!painterPrompt} />
                        </div>
                        {painterGeneratedImage && (
                            <div className={`relative ${getAspectRatioClass(painterAspectRatio)}`}>
                                <img src={painterGeneratedImage} alt="生成された画像" className="w-full h-full object-contain rounded-lg" />
                                <button onClick={() => downloadFile(painterGeneratedImage, 'painted-image.jpg')} className="absolute top-2 right-2 bg-gray-900/70 text-white p-2 rounded-full hover:bg-gray-800/90 transition transform hover:scale-110">
                                    <DownloadIcon />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        ) : mainTab === 'settings' ? (
            <div className="fade-in max-w-2xl mx-auto">
                <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
                    <h2 className="text-2xl font-bold border-b border-gray-700 pb-4">設定</h2>
                    <div className="space-y-4">
                        {/* Gemini API Toggle */}
                        <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-lg">
                            <div>
                                <span className={`font-medium text-lg ${useGeminiApi ? 'text-green-400' : 'text-gray-400'}`}>
                                    Gemini APIを使用
                                </span>
                                <p className="text-xs text-gray-500">OFFにすると、APIを消費しないシミュレーションモードで動作します。</p>
                            </div>
                            <label htmlFor="api-toggle" className="inline-flex relative items-center cursor-pointer">
                                <input type="checkbox" id="api-toggle" className="sr-only peer" checked={useGeminiApi} onChange={() => setUseGeminiApi(!useGeminiApi)} />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                         {/* Prompt Optimization Toggle */}
                        <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-lg">
                            <div>
                                <span className={`font-medium text-lg ${isPromptOptimizationEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                                    プロンプト最適化
                                </span>
                                <p className="text-xs text-gray-500">動画生成前にプロンプトをAIで最適化し、トークン数を削減します。</p>
                            </div>
                            <label htmlFor="prompt-opt-toggle" className="inline-flex relative items-center cursor-pointer">
                                <input type="checkbox" id="prompt-opt-toggle" className="sr-only peer" checked={isPromptOptimizationEnabled} onChange={() => setIsPromptOptimizationEnabled(!isPromptOptimizationEnabled)} />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                        {/* Auto Save Toggle */}
                        <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-lg">
                            <div>
                                <span className={`font-medium text-lg ${isAutoSaveEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                                    自動保存
                                </span>
                                <p className="text-xs text-gray-500">30秒ごとに作業内容をブラウザに自動保存します。</p>
                            </div>
                            <label htmlFor="autosave-toggle" className="inline-flex relative items-center cursor-pointer">
                                <input type="checkbox" id="autosave-toggle" className="sr-only peer" checked={isAutoSaveEnabled} onChange={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)} />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                        {/* Quota Visibility Toggle */}
                        <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-lg">
                             <div>
                                <span className={`font-medium text-lg ${isQuotaCostVisible ? 'text-green-400' : 'text-gray-400'}`}>
                                    クォータ消費表示
                                </span>
                                <p className="text-xs text-gray-500">各生成ボタンの横にAPIクォータ消費量を表示します。</p>
                            </div>
                            <label htmlFor="quota-toggle" className="inline-flex relative items-center cursor-pointer">
                                <input type="checkbox" id="quota-toggle" className="sr-only peer" checked={isQuotaCostVisible} onChange={() => setIsQuotaCostVisible(!isQuotaCostVisible)} />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                    </div>
                    {/* Quota Display */}
                    {useGeminiApi && (
                      <div className="text-sm bg-gray-900/50 p-4 rounded-lg space-y-3">
                         <h3 className="font-bold text-lg text-gray-300">現在のAPI使用状況</h3>
                         <div className="space-y-2 text-sm">
                           <div>
                               <p className="text-gray-400">汎用 (分間)</p>
                               <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-green-500 h-2.5 rounded-full" style={{width: `${(Math.max(0, apiRemaining) / GEMINI_API_MPM_LIMIT) * 100}%`}}></div></div>
                               <p className="text-right text-xs"><span className="font-bold">{Math.max(0, apiRemaining)}</span> / {GEMINI_API_MPM_LIMIT}</p>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                               <div>
                                   <p className="text-gray-400">画像 (分間)</p>
                                   <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-cyan-500 h-2.5 rounded-full" style={{width: `${(Math.max(0, imageApiRemaining) / IMAGE_API_MPM_LIMIT) * 100}%`}}></div></div>
                                   <p className="text-right text-xs"><span className="font-bold">{Math.max(0, imageApiRemaining)}</span> / {IMAGE_API_MPM_LIMIT}</p>
                               </div>
                               <div>
                                   <p className="text-gray-400">画像 (日間)</p>
                                   <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-cyan-500 h-2.5 rounded-full" style={{width: `${(dailyImageUsage / IMAGE_API_DPM_LIMIT) * 100}%`}}></div></div>
                                   <p className="text-right text-xs"><span className="font-bold">{dailyImageUsage}</span> / {IMAGE_API_DPM_LIMIT}</p>
                               </div>
                               <div>
                                   <p className="text-gray-400">動画 (分間)</p>
                                   <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-purple-500 h-2.5 rounded-full" style={{width: `${(Math.max(0, videoApiRemaining) / VIDEO_API_MPM_LIMIT) * 100}%`}}></div></div>
                                   <p className="text-right text-xs"><span className="font-bold">{Math.max(0, videoApiRemaining)}</span> / {VIDEO_API_MPM_LIMIT}</p>
                               </div>
                               <div>
                                   <p className="text-gray-400">動画 (日間)</p>
                                   <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-purple-500 h-2.5 rounded-full" style={{width: `${(dailyVideoUsage / VIDEO_API_DPM_LIMIT) * 100}%`}}></div></div>
                                   <p className="text-right text-xs"><span className="font-bold">{dailyVideoUsage}</span> / {VIDEO_API_DPM_LIMIT}</p>
                               </div>
                           </div>
                         </div>
                      </div>
                    )}
                </div>
            </div>
        ) : null}
      </main>
      
      {isBgModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-lg flex flex-col gap-4">
              <h2 className="text-2xl font-bold">カスタム背景を生成</h2>
              <textarea
                  value={bgPrompt}
                  onChange={(e) => setBgPrompt(e.target.value)}
                  placeholder="背景の詳細な説明を入力 (例: a magical forest with glowing mushrooms at night)"
                  className="w-full h-24 p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
              <div className="grid grid-cols-2 gap-4">
                  <AspectRatioSelector value={bgAspectRatio} onChange={setBgAspectRatio} labelId="bg-aspect-ratio" />
                  <ModelSelector value={imageGenModel} onChange={setImageGenModel} options={IMAGE_GEN_MODELS} labelId="image-gen-model-bg" label="画像生成モデル" />
              </div>
              <button onClick={handleGenerateBackground} disabled={isGeneratingBg} className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition disabled:opacity-50">
                  {isGeneratingBg ? '生成中...' : '背景を生成'}
              </button>
              {isGeneratingBg && <div className="loader w-6 h-6 rounded-full border-2 border-gray-700 mx-auto"></div>}
              {generatedBgUrl && (
                  <div className="space-y-2">
                      <img src={generatedBgUrl} alt="生成された背景" className={`w-full ${getAspectRatioClass(bgAspectRatio)} object-contain rounded-lg bg-gray-900`} />
                      <button onClick={handleUseGeneratedBackground} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition">
                          この背景を使用
                      </button>
                  </div>
              )}
              <button onClick={() => setIsBgModalOpen(false)} className="mt-2 text-gray-400 hover:text-white">閉じる</button>
          </div>
        </div>
      )}

      {isSpriteSheetModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-xl flex flex-col gap-4">
              <h2 className="text-2xl font-bold">スプライトシート生成: <span className="text-indigo-400">{generatingSpriteSheetFor?.params.name}</span></h2>
              {isGeneratingSpriteSheet || spriteGenerationProgress ? (
                  <div className="text-center py-8">
                      <div className="loader w-12 h-12 rounded-full border-4 border-gray-700 mx-auto mb-4"></div>
                      <p className="text-lg font-semibold">スプライトシートを生成中...</p>
                      {spriteGenerationProgress && (
                          <div className="mt-4">
                            <p className="text-gray-400">{spriteGenerationProgress.currentPose}</p>
                            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${(spriteGenerationProgress.current / spriteGenerationProgress.total) * 100}%` }}></div>
                            </div>
                            <p className="text-sm mt-1">{spriteGenerationProgress.current} / {spriteGenerationProgress.total}</p>
                          </div>
                      )}
                  </div>
              ) : generatedSpriteSheetUrl ? (
                  <div className="space-y-4">
                      <img src={generatedSpriteSheetUrl} alt="生成されたスプライトシート" className="w-full object-contain rounded-lg bg-gray-900 border border-gray-700" />
                      <button onClick={handleDownloadSpriteSheet} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                          <DownloadIcon /> ダウンロード
                      </button>
                  </div>
              ) : <p className="text-center text-gray-500">エラーが発生しました。</p>}

              <button onClick={handleCloseSpriteSheetModal} className="mt-2 text-gray-400 hover:text-white">閉じる</button>
          </div>
        </div>
      )}

      {editingKeyframeInfo && <KeyframeEditorModal />}
      {isIntermediateModalOpen && <IntermediateKeyframeModal />}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
