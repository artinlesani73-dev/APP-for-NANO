// Session represents a single conversation/session with all its generations
export interface Session {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  generations: SessionGeneration[];
  graph?: GraphState;
}

// Generation data embedded in session (not separated)
export interface StoredImageMeta {
  id: string;
  filename: string;
  hash?: string;
  original_name?: string;
  size_bytes?: number;
}

export interface UploadedImagePayload {
  data: string;
  original_name?: string;
  size_bytes?: number;
}

export interface SessionGeneration {
  generation_id: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';

  // Inputs
  prompt: string;
  control_images?: StoredImageMeta[];
  reference_images?: StoredImageMeta[];

  // Parameters
  parameters: GenerationConfig;

  // Outputs
  output_image?: StoredImageMeta;
  output_images?: StoredImageMeta[];
  output_texts?: string[];
  generation_time_ms?: number;
  error?: string;
}

// Legacy Chat interface (for backwards compatibility)
export interface Chat {
  chat_id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  generation_ids: string[];
}

export interface Prompt {
  prompt_id: string;
  prompt_hash: string;
  text: string;
  created_at: string;
  used_count: number;
}

export type ImageRole = 'control' | 'reference' | 'output';

export interface ImageRecord {
  image_id: string;
  image_hash: string;
  role: ImageRole;
  data_uri: string; // Storing base64 directly for this local-first demo
  created_at: string;
  metadata: {
    width: number;
    height: number;
    size_bytes: number;
    mime_type: string;
  };
}

export interface GenerationConfig {
  temperature: number;
  top_p: number;
  aspect_ratio: string;
  image_size: string;
  safety_filter: string;
  model: string;
}

export interface GraphNode {
  id: string;
  generationId?: string;
  type: 'prompt' | 'workflow' | 'control-image' | 'reference-image' | 'output-image' | 'output-text';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: any;
  isStandalone?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  toHandle?: 'prompt' | 'control' | 'reference';
  color: string;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Generation {
  generation_id: string;
  chat_id: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  inputs: {
    prompt_hash: string;
    control_image_hash?: string | null;
    reference_image_hash?: string | null;
  };
  parameters: GenerationConfig;
  outputs?: {
    image_hash: string;
    generation_time_ms: number;
  };
  error?: string;
}

export interface Relationship {
  relationship_id: string;
  generation_id: string;
  nodes: {
    prompt: string; // hash
    control_image?: string; // hash
    reference_image?: string; // hash
    output_image?: string; // hash
  };
  graph: {
    from: string;
    to: string;
    type: 'generates' | 'controls' | 'references';
  }[];
}

// UI State Types
export interface AppState {
  currentChatId: string | null;
  chats: Chat[];
  activeGeneration: Generation | null;
}

export type LogEventType = 'login' | 'action' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  type: LogEventType;
  message: string;
  context?: Record<string, unknown>;
}

export interface AdminMetrics {
  platform: string;
  arch: string;
  uptimeSeconds: number;
  memory: {
    total: number;
    used: number;
    free: number;
    percentUsed: number;
  };
  cpu: {
    cores: number;
    load: number;
    model: string;
  };
  sessions: number;
  timestamp: string;
}
