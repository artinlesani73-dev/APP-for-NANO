import React, { useState, useRef, useEffect } from 'react';
import { Session, SessionGeneration, GenerationConfig, GraphNode, GraphEdge } from '../types';
import { FileText, Settings, Image as ImageIcon, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { StorageService } from '../services/newStorageService';

interface GraphViewProps {
  sessions: Session[];
  theme: 'dark' | 'light';
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;
  onGenerateFromNode?: (prompt: string, config: GenerationConfig, controlImages?: string[], referenceImages?: string[]) => Promise<void>;
}

type Node = GraphNode;
type Edge = GraphEdge;

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.7,
  top_p: 0.95,
  aspect_ratio: '1:1',
  image_size: '1K',
  safety_filter: 'medium',
  model: 'gemini-2.5-flash-image'
};

const NODE_WIDTH = 230;
const NODE_HEIGHT = 150;
const IMAGE_NODE_HEIGHT = 320;
const OUTPUT_IMAGE_HEIGHT = 420;
const WORKFLOW_NODE_HEIGHT = 240;
const WORKFLOW_NODE_WIDTH = 300;
const OUTPUT_IMAGE_WIDTH = 260;
const BASE_X = 100;
const BASE_Y = 160;
const COLUMN_SPACING = 360;
const GENERATION_SPACING = 460;

const themeTokens = {
  dark: {
    background: '#0d0b14',
    card: '#161021',
    cardMuted: '#120d1b',
    stroke: '#2c243c',
    border: 'border-white/5',
    textPrimary: 'text-zinc-100',
    textMuted: 'text-zinc-400',
    panel: 'bg-[#161021]/85 border border-white/5 backdrop-blur-lg',
  },
  light: {
    background: '#f5f7fd',
    card: '#ffffff',
    cardMuted: '#f1f3fb',
    stroke: '#e5e7eb',
    border: 'border-zinc-200',
    textPrimary: 'text-zinc-900',
    textMuted: 'text-zinc-500',
    panel: 'bg-white/90 border border-zinc-200 backdrop-blur-xl',
  }
};

const GraphView: React.FC<GraphViewProps> = ({ sessions, theme, loadImage, onGenerateFromNode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const palette = themeTokens[theme];
  const nodeAccents: Record<Node['type'], { solid: string; soft: string; text: string }> = {
    'prompt': { solid: '#a855f7', soft: 'rgba(168,85,247,0.12)', text: '#f5ecff' },
    'workflow': { solid: '#6366f1', soft: 'rgba(99,102,241,0.12)', text: '#eef1ff' },
    'control-image': { solid: '#10b981', soft: 'rgba(16,185,129,0.1)', text: '#e6fff4' },
    'reference-image': { solid: '#3b82f6', soft: 'rgba(59,130,246,0.12)', text: '#e8f1ff' },
    'output-image': { solid: '#f59e0b', soft: 'rgba(245,158,11,0.14)', text: '#fff8e6' },
    'output-text': { solid: '#f59e0b', soft: 'rgba(245,158,11,0.14)', text: '#fff8e6' }
  } as const;
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(0.7);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | 'all'>('all');

  useEffect(() => {
    generateGraphLayout();
  }, [sessions, selectedSessionId]);

  useEffect(() => {
    if (editingNode && nodes.length > 0) {
      setEditingNode(null);
    }
  }, [nodes.length]);

  // Handle wheel events with non-passive listener
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      setZoom(prevZoom => Math.min(Math.max(0.2, prevZoom + delta), 2));
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

  const inputHandleColors = {
    prompt: nodeAccents['prompt'].solid,
    control: nodeAccents['control-image'].solid,
    reference: nodeAccents['reference-image'].solid
  } as const;

  // Helper function to create a unique key for workflow grouping
  const getWorkflowGroupKey = (
    promptText: string,
    params: GenerationConfig,
    userName: string,
    controlImageIds: string[],
    referenceImageIds: string[]
  ) => {
    return JSON.stringify({
      prompt: promptText,
      params,
      user: userName,
      control: controlImageIds.sort(),
      reference: referenceImageIds.sort()
    });
  };

  // Helper function to get image key for deduplication
  // Use only ID to ensure the same image appears as one node regardless of role
  const getImageKey = (id: string) => {
    return id;
  };

  const generateGraphLayout = () => {
    // Filter sessions based on selection
    const filteredSessions = selectedSessionId === 'all'
      ? sessions
      : sessions.filter(s => s.session_id === selectedSessionId);

    if (filteredSessions.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Collect all generations
    const allGenerations: Array<{ session: Session; generation: SessionGeneration }> = [];
    filteredSessions.forEach(session => {
      session.generations.forEach(generation => {
        allGenerations.push({ session, generation });
      });
    });

    if (allGenerations.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Maps for grouping
    const promptGroups = new Map<string, string>(); // prompt text -> node id
    const workflowGroups = new Map<string, string>(); // workflow key -> node id
    const imageGroups = new Map<string, string>(); // image id -> node id

    // Track roles and metadata for each image node
    interface ImageNodeInfo {
      nodeId: string;
      roles: Set<'control' | 'reference' | 'output'>;
      imageData: string | null;
      meta: any; // StoredImageMeta
      outputText?: string;
      firstSeenGenIndex: number; // Track which generation first used this image
      firstSeenYOffset: number; // Track the yOffset when first seen
    }
    const imageNodeInfoMap = new Map<string, ImageNodeInfo>(); // image id -> info

    let yOffset = BASE_Y;

    allGenerations.forEach(({ session, generation }, genIndex) => {
      const userName = 'User'; // We'll use a default user name for now

      // 1. Handle Prompt Node (group by exact text)
      const promptText = generation.prompt || 'Empty prompt';
      let promptNodeId = promptGroups.get(promptText);

      if (!promptNodeId) {
        promptNodeId = `prompt-${promptText.substring(0, 20).replace(/\s+/g, '-')}-${genIndex}`;
        promptGroups.set(promptText, promptNodeId);

        newNodes.push({
          id: promptNodeId,
          type: 'prompt',
          label: 'Prompt',
          x: BASE_X,
          y: yOffset,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          data: { text: promptText, status: generation.status }
        });
      }

      // 2. Handle Control Images (deduplicate by ID)
      const controlImageIds: string[] = [];
      (generation.control_images || []).forEach((img) => {
        const imageKey = getImageKey(img.id);
        let imageNodeId = imageGroups.get(imageKey);
        let imageInfo = imageNodeInfoMap.get(img.id);

        if (!imageInfo) {
          // First time seeing this image
          imageNodeId = `image-${img.id}`;
          imageGroups.set(imageKey, imageNodeId);
          const imageData = loadImage('control', img.id, img.filename);

          imageInfo = {
            nodeId: imageNodeId,
            roles: new Set(['control']),
            imageData,
            meta: img,
            firstSeenGenIndex: genIndex,
            firstSeenYOffset: yOffset
          };
          imageNodeInfoMap.set(img.id, imageInfo);
        } else {
          // Image already exists, add control role
          imageInfo.roles.add('control');
          imageNodeId = imageInfo.nodeId;
        }

        controlImageIds.push(imageNodeId);
      });

      // 3. Handle Reference Images (deduplicate by ID)
      const referenceImageIds: string[] = [];
      (generation.reference_images || []).forEach((img) => {
        const imageKey = getImageKey(img.id);
        let imageNodeId = imageGroups.get(imageKey);
        let imageInfo = imageNodeInfoMap.get(img.id);

        if (!imageInfo) {
          // First time seeing this image
          imageNodeId = `image-${img.id}`;
          imageGroups.set(imageKey, imageNodeId);
          const imageData = loadImage('reference', img.id, img.filename);

          imageInfo = {
            nodeId: imageNodeId,
            roles: new Set(['reference']),
            imageData,
            meta: img,
            firstSeenGenIndex: genIndex,
            firstSeenYOffset: yOffset
          };
          imageNodeInfoMap.set(img.id, imageInfo);
        } else {
          // Image already exists, add reference role
          imageInfo.roles.add('reference');
          imageNodeId = imageInfo.nodeId;
        }

        referenceImageIds.push(imageNodeId);
      });

      // 4. Handle Workflow Node (group by exact match of all inputs)
      const workflowGroupKey = getWorkflowGroupKey(
        promptText,
        generation.parameters,
        userName,
        controlImageIds,
        referenceImageIds
      );
      let workflowNodeId = workflowGroups.get(workflowGroupKey);

      if (!workflowNodeId) {
        workflowNodeId = `workflow-${genIndex}`;
        workflowGroups.set(workflowGroupKey, workflowNodeId);

        newNodes.push({
          id: workflowNodeId,
          type: 'workflow',
          label: 'Workflow',
          x: BASE_X + COLUMN_SPACING * 2,
          y: yOffset,
          width: WORKFLOW_NODE_WIDTH,
          height: WORKFLOW_NODE_HEIGHT,
          data: { parameters: generation.parameters, userName }
        });
      }

      // 5. Create edges from prompt to workflow
      const promptEdge = {
        from: promptNodeId,
        to: workflowNodeId,
        toHandle: 'prompt' as const,
        color: '#8b5cf6'
      };
      if (!newEdges.some(e => e.from === promptEdge.from && e.to === promptEdge.to && e.toHandle === promptEdge.toHandle)) {
        newEdges.push(promptEdge);
      }

      // 6. Create edges from control images to workflow
      controlImageIds.forEach(imageId => {
        const edge = {
          from: imageId,
          to: workflowNodeId,
          toHandle: 'control' as const,
          color: '#10b981'
        };
        if (!newEdges.some(e => e.from === edge.from && e.to === edge.to && e.toHandle === edge.toHandle)) {
          newEdges.push(edge);
        }
      });

      // 7. Create edges from reference images to workflow
      referenceImageIds.forEach(imageId => {
        const edge = {
          from: imageId,
          to: workflowNodeId,
          toHandle: 'reference' as const,
          color: '#3b82f6'
        };
        if (!newEdges.some(e => e.from === edge.from && e.to === edge.to && e.toHandle === edge.toHandle)) {
          newEdges.push(edge);
        }
      });

      // 8. Handle Output Images (deduplicate by ID)
      const outputImages = generation.output_images || (generation.output_image ? [generation.output_image] : []);
      outputImages.forEach((img, idx) => {
        const imageKey = getImageKey(img.id);
        let imageNodeId = imageGroups.get(imageKey);
        let imageInfo = imageNodeInfoMap.get(img.id);

        if (!imageInfo) {
          // First time seeing this image
          imageNodeId = `image-${img.id}`;
          imageGroups.set(imageKey, imageNodeId);
          const imageData = loadImage('output', img.id, img.filename);

          imageInfo = {
            nodeId: imageNodeId,
            roles: new Set(['output']),
            imageData,
            meta: img,
            outputText: generation.output_texts?.[idx],
            firstSeenGenIndex: genIndex,
            firstSeenYOffset: yOffset
          };
          imageNodeInfoMap.set(img.id, imageInfo);
        } else {
          // Image already exists, add output role
          imageInfo.roles.add('output');
          imageNodeId = imageInfo.nodeId;
          // Update output text if available
          if (generation.output_texts?.[idx]) {
            imageInfo.outputText = generation.output_texts[idx];
          }
        }

        // Create edge from workflow to output
        const edge = {
          from: workflowNodeId,
          to: imageNodeId,
          color: '#f59e0b'
        };
        if (!newEdges.some(e => e.from === edge.from && e.to === edge.to)) {
          newEdges.push(edge);
        }
      });

      yOffset += GENERATION_SPACING;
    });

    // Now create actual nodes for all images based on their roles
    imageNodeInfoMap.forEach((info, imageId) => {
      const roles = Array.from(info.roles);
      const hasOutput = info.roles.has('output');
      const hasControl = info.roles.has('control');
      const hasReference = info.roles.has('reference');
      const hasInput = hasControl || hasReference;

      // Determine node type and position based on roles
      let nodeType: Node['type'];
      let xPosition: number;
      let label: string;

      if (hasOutput && hasInput) {
        // Multi-role image: both output and input
        nodeType = 'output-image'; // Use output-image as base type
        xPosition = BASE_X + COLUMN_SPACING * 2.5; // Position between workflow and output
        const roleLabels = roles.map(r => r.charAt(0).toUpperCase() + r.slice(1));
        label = roleLabels.join(' + ');
      } else if (hasOutput) {
        // Output only
        nodeType = 'output-image';
        xPosition = BASE_X + COLUMN_SPACING * 3;
        label = 'Output';
      } else if (hasControl && hasReference) {
        // Both control and reference
        nodeType = 'control-image';
        xPosition = BASE_X + COLUMN_SPACING;
        label = 'Control + Reference';
      } else if (hasControl) {
        // Control only
        nodeType = 'control-image';
        xPosition = BASE_X + COLUMN_SPACING;
        label = 'Control';
      } else {
        // Reference only
        nodeType = 'reference-image';
        xPosition = BASE_X + COLUMN_SPACING;
        label = 'Reference';
      }

      newNodes.push({
        id: info.nodeId,
        type: nodeType,
        label,
        x: xPosition,
        y: info.firstSeenYOffset, // Use the yOffset from when we first saw this image
        width: hasOutput ? OUTPUT_IMAGE_WIDTH : NODE_WIDTH,
        height: hasOutput ? OUTPUT_IMAGE_HEIGHT : IMAGE_NODE_HEIGHT,
        data: {
          image: info.meta,
          imageData: info.imageData,
          text: info.outputText,
          roles: roles // Store all roles in data
        }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const getInputHandlePosition = (node: Node, handle?: 'prompt' | 'control' | 'reference') => {
    if (node.type === 'workflow' && handle) {
      const handleSpacing = node.height / 4;
      const handleYOffsets = {
        prompt: handleSpacing,
        control: handleSpacing * 2,
        reference: handleSpacing * 3
      };
      return {
        x: node.x,
        y: node.y + handleYOffsets[handle]
      };
    }
    // For all other nodes, input handle is on the left center
    return {
      x: node.x,
      y: node.y + node.height / 2
    };
  };

  const getOutputHandlePosition = (node: Node) => {
    // All nodes have output handle on the right center
    return {
      x: node.x + node.width,
      y: node.y + node.height / 2
    };
  };

  const generateCurvePath = (from: Node, to: Node, toHandle?: 'prompt' | 'control' | 'reference') => {
    const fromPos = getOutputHandlePosition(from);
    const fromX = fromPos.x;
    const fromY = fromPos.y;

    const toPos = getInputHandlePosition(to, toHandle);
    const toX = toPos.x;
    const toY = toPos.y;

    const midX = (fromX + toX) / 2;

    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId?: string) => {
    if (nodeId) {
      // Start dragging a node
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setDraggingNode(nodeId);
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const svgX = (e.clientX - rect.left - pan.x) / zoom;
          const svgY = (e.clientY - rect.top - pan.y) / zoom;
          setDragOffset({
            x: svgX - node.x,
            y: svgY - node.y
          });
        }
      }
    } else if (e.button === 0) {
      // Start panning the canvas
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      // Drag the node
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const svgX = (e.clientX - rect.left - pan.x) / zoom;
        const svgY = (e.clientY - rect.top - pan.y) / zoom;

        setNodes(prevNodes =>
          prevNodes.map(n =>
            n.id === draggingNode
              ? { ...n, x: svgX - dragOffset.x, y: svgY - dragOffset.y }
              : n
          )
        );
      }
    } else if (isPanning) {
      // Pan the canvas
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNode(null);
  };

  // Generate from workflow node
  const handleGenerateFromWorkflow = async (workflowNodeId: string) => {
    if (!onGenerateFromNode) return;

    const workflowNode = nodes.find(n => n.id === workflowNodeId);
    if (!workflowNode || workflowNode.type !== 'workflow') return;

    // Find connected nodes
    const connectedEdges = edges.filter(e => e.to === workflowNodeId);
    const promptEdge = connectedEdges.find(e => e.toHandle === 'prompt');
    const controlEdges = connectedEdges.filter(e => e.toHandle === 'control');
    const referenceEdges = connectedEdges.filter(e => e.toHandle === 'reference');

    // Get prompt
    const promptNode = promptEdge ? nodes.find(n => n.id === promptEdge.from) : null;
    const prompt = promptNode?.data?.text || 'Default prompt';

    // Get control images
    const controlImages: string[] = [];
    for (const edge of controlEdges) {
      const node = nodes.find(n => n.id === edge.from);
      if (node?.data?.imageData) {
        controlImages.push(node.data.imageData);
      }
    }

    // Get reference images
    const referenceImages: string[] = [];
    for (const edge of referenceEdges) {
      const node = nodes.find(n => n.id === edge.from);
      if (node?.data?.imageData) {
        referenceImages.push(node.data.imageData);
      }
    }

    // Call the generation function
    await onGenerateFromNode(
      prompt,
      workflowNode.data.parameters,
      controlImages.length > 0 ? controlImages : undefined,
      referenceImages.length > 0 ? referenceImages : undefined
    );
  };

  // Update node data (for editing)
  const updateNodeData = (nodeId: string, newData: any) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const renderNode = (node: Node) => {
    const isImage = node.type.includes('image');
    const isDark = theme === 'dark';
    const accent = nodeAccents[node.type];
    // Disable workflow editing in graph view since we're viewing across sessions
    const workflowEditingEnabled = false;
    const isWorkflowEditing = workflowEditingEnabled && editingNode === node.id;

    const inputHandles: Array<{ x: number; y: number; color: string; id: string }> = [];
    if (node.type === 'workflow') {
      const handleSpacing = node.height / 4;
      inputHandles.push(
        { x: 0, y: handleSpacing, color: inputHandleColors.prompt, id: 'prompt' },
        { x: 0, y: handleSpacing * 2, color: inputHandleColors.control, id: 'control' },
        { x: 0, y: handleSpacing * 3, color: inputHandleColors.reference, id: 'reference' }
      );
    } else {
      inputHandles.push({ x: 0, y: node.height / 2, color: accent.solid, id: 'input' });
    }

    const outputHandle = { x: node.width, y: node.height / 2, color: accent.solid };

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleMouseDown(e, node.id);
        }}
        style={{ cursor: 'move' }}
      >
        <rect
          width={node.width}
          height={node.height}
          rx={18}
          fill={palette.card}
          stroke={palette.stroke}
          strokeWidth={1.2}
        />

        {/* Decorative handles */}
        <g pointerEvents="none">
          {inputHandles.map((handle) => (
            <circle
              key={`${node.id}-${handle.id}`}
              cx={handle.x}
              cy={handle.y}
              r={7}
              fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
              stroke={handle.color}
              strokeWidth={1.5}
            />
          ))}
          <circle
            cx={outputHandle.x}
            cy={outputHandle.y}
            r={7}
            fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
            stroke={outputHandle.color}
            strokeWidth={1.5}
          />
        </g>

        {/* Node icon and title */}
        <g transform="translate(14, 12)">
          <foreignObject width={node.width - 28} height={20}>
            <div
              className="flex items-center gap-2 text-[12px]"
              style={{ color: isDark ? '#f7f7fb' : '#0f172a' }}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center">
                {node.type === 'prompt' && <FileText size={14} color={accent.solid} />}
                {node.type === 'workflow' && <Settings size={14} color={accent.solid} />}
                {node.type.includes('image') && <ImageIcon size={14} color={accent.solid} />}
              </span>
              <span className="text-sm font-semibold tracking-tight" style={{ color: isDark ? '#f3f1ff' : '#0f172a' }}>{node.label}</span>
            </div>
          </foreignObject>
        </g>

        {/* Node content */}
        <foreignObject x={14} y={52} width={node.width - 28} height={node.height - 64}>
          <div className={`flex flex-col h-full gap-3 text-[12px] leading-[18px] ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
            {node.type === 'prompt' && (
              node.isStandalone && editingNode === node.id ? (
                <textarea
                  className="w-full h-full bg-transparent text-[12px] leading-[18px] text-inherit resize-none outline-none"
                  value={node.data.text}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateNodeData(node.id, { text: e.target.value });
                  }}
                  onBlur={() => setEditingNode(null)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <p
                  className="text-[12px] leading-[18px] whitespace-pre-wrap break-words cursor-text select-text"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (node.isStandalone) setEditingNode(node.id);
                  }}
                >
                  {node.data.text}
                </p>
              )
            )}

            {node.type === 'workflow' && (
              <div className="flex flex-col gap-2 py-1">
                {node.data?.userName && (
                  <div className={`flex items-center justify-between text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    <span>User</span>
                    <span className={`${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>{node.data.userName}</span>
                  </div>
                )}
                <div className={`grid grid-cols-2 gap-y-1 text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  <span>Model</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.model.includes('flash') ? 'Flash' : 'Pro'}
                  </span>
                  <span>Temperature</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.temperature}
                  </span>
                  <span>Top-p</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.top_p}
                  </span>
                  <span>Aspect</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.aspect_ratio}
                  </span>
                  <span>Size</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.image_size}
                  </span>
                  <span>Safety</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium capitalize`}>
                    {node.data.parameters.safety_filter}
                  </span>
                </div>
              </div>
            )}

            {isImage && (
              <div className="h-full flex flex-col gap-2">
                <div className={`flex-1 rounded-xl overflow-hidden border ${isDark ? 'border-white/10 bg-black/30' : 'border-zinc-200 bg-white'}`}>
                  {node.data.imageData ? (
                    <img
                      src={node.data.imageData}
                      alt={node.label}
                      className="w-full h-[280px] object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className={`w-full h-[280px] flex items-center justify-center ${isDark ? 'bg-black/20' : 'bg-zinc-50'}`}>
                      <ImageIcon className={isDark ? 'text-zinc-500' : 'text-zinc-400'} size={32} />
                    </div>
                  )}
                </div>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'} truncate`}>
                  {node.data.image?.filename || 'No image'}
                </p>
                {node.type === 'output-image' && (
                  <p className={`text-[11px] leading-[18px] whitespace-pre-wrap ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    {node.data.text || 'Text output will appear here'}
                  </p>
                )}
              </div>
            )}

            {node.type === 'output-text' && (
              <div className="h-full flex flex-col">
                <p className={`w-full h-full text-[12px] leading-[18px] whitespace-pre-wrap break-words ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
                  {node.data.text || 'Text output'}
                </p>
              </div>
            )}
          </div>
        </foreignObject>

      </g>
    );
  };

  const renderEdge = (edge: Edge, index: number) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);

    if (!fromNode || !toNode) return null;

    const path = generateCurvePath(fromNode, toNode, edge.toHandle);

    // Generate unique key using index to avoid duplicates
    const key = `edge-${index}-${edge.from}-${edge.to}-${edge.toHandle || 'none'}`;

    return (
      <path
        key={key}
        d={path}
        stroke={edge.color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
        opacity={0.9}
      />
    );
  };

  const isDark = theme === 'dark';
  const legendItems = [
    { label: 'Prompt Flow', color: 'from-purple-500 to-purple-400' },
    { label: 'Control Images', color: 'from-emerald-500 to-emerald-400' },
    { label: 'Reference Images', color: 'from-sky-500 to-sky-400' },
    { label: 'Output', color: 'from-amber-500 to-amber-400' }
  ];

  const minimapWidth = 240;
  const minimapHeight = 150;
  const minimapPadding = 18;
  const bounds = nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxX: Math.max(acc.maxX, node.x + node.width),
      maxY: Math.max(acc.maxY, node.y + node.height)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  const graphWidth = nodes.length === 0 ? 1 : bounds.maxX - bounds.minX || 1;
  const graphHeight = nodes.length === 0 ? 1 : bounds.maxY - bounds.minY || 1;
  const minimapScale = Math.min(
    (minimapWidth - minimapPadding * 2) / graphWidth,
    (minimapHeight - minimapPadding * 2) / graphHeight
  );
  const offsetX = minimapPadding - (nodes.length ? bounds.minX * minimapScale : 0);
  const offsetY = minimapPadding - (nodes.length ? bounds.minY * minimapScale : 0);

  const projectPoint = (x: number, y: number) => ({
    x: x * minimapScale + offsetX,
    y: y * minimapScale + offsetY
  });

  const nodeMap = new Map(nodes.map(node => [node.id, node]));

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden select-none ${isDark ? 'text-white' : 'text-zinc-900'}`}
      style={{
        backgroundColor: palette.background,
        backgroundImage: `radial-gradient(circle, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'} 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
      }}
    >
      {/* Unified toolbar anchored to bottom */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="flex flex-col lg:flex-row items-end gap-3 w-full">
          <div className={`rounded-2xl p-3 w-full lg:w-72 backdrop-blur-xl ${palette.panel}`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Minimap</div>
              <span className={`text-[11px] px-2 py-1 rounded-full ${isDark ? 'bg-white/5 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                {selectedSessionId === 'all'
                  ? `All Sessions (${sessions.length})`
                  : sessions.find(s => s.session_id === selectedSessionId)?.title || 'Session'}
              </span>
            </div>
            <div className={`rounded-xl border ${isDark ? 'border-white/10 bg-black/30' : 'border-zinc-200 bg-white'}`}>
              {nodes.length === 0 ? (
                <div className={`h-[130px] flex items-center justify-center text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  No graph data
                </div>
              ) : (
                <svg width={minimapWidth} height={minimapHeight} className="rounded-xl">
                  {/* Edges */}
                  {edges.map((edge, idx) => {
                    const fromNode = nodeMap.get(edge.from);
                    const toNode = nodeMap.get(edge.to);
                    if (!fromNode || !toNode) return null;
                    const fromPos = getOutputHandlePosition(fromNode);
                    const toPos = getInputHandlePosition(toNode, edge.toHandle);
                    const p1 = projectPoint(fromPos.x, fromPos.y);
                    const p2 = projectPoint(toPos.x, toPos.y);
                    return (
                      <line
                        key={`${edge.from}-${edge.to}-${idx}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={edge.color}
                        strokeWidth={1}
                        strokeOpacity={0.8}
                      />
                    );
                  })}

                  {/* Nodes */}
                  {nodes.map(node => {
                    const pos = projectPoint(node.x, node.y);
                    const size = { w: node.width * minimapScale, h: node.height * minimapScale };
                    const accent = nodeAccents[node.type];
                    return (
                      <rect
                        key={node.id}
                        x={pos.x}
                        y={pos.y}
                        width={Math.max(size.w, 4)}
                        height={Math.max(size.h, 4)}
                        rx={4}
                        fill={accent.soft}
                        stroke={accent.solid}
                        strokeWidth={0.8}
                      />
                    );
                  })}
                </svg>
              )}
            </div>
          </div>

          <div className={`flex-1 rounded-2xl px-4 py-2 backdrop-blur-xl ${palette.panel}`}>
            <div
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b ${
                isDark ? 'border-white/10' : 'border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`font-semibold text-sm ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Graph Toolbar</div>
                <span className={`text-[11px] px-2 py-1 rounded-full ${isDark ? 'bg-white/5 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                  {nodes.length} nodes · {edges.length} edges
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
                  className={`h-9 px-3 inline-flex items-center gap-2 rounded-xl text-xs border transition ${isDark ? 'border-white/10 hover:bg-white/5 text-white' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-900'}`}
                >
                  <ZoomIn size={14} />
                  <span className="hidden sm:inline">Zoom In</span>
                </button>
                <button
                  onClick={() => setZoom(Math.max(zoom - 0.1, 0.2))}
                  className={`h-9 px-3 inline-flex items-center gap-2 rounded-xl text-xs border transition ${isDark ? 'border-white/10 hover:bg-white/5 text-white' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-900'}`}
                >
                  <ZoomOut size={14} />
                  <span className="hidden sm:inline">Zoom Out</span>
                </button>
                <button
                  onClick={() => { setZoom(0.7); setPan({ x: 50, y: 50 }); }}
                  className={`h-9 px-3 inline-flex items-center gap-2 rounded-xl text-xs border transition ${isDark ? 'border-white/10 hover:bg-white/5 text-white' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-900'}`}
                >
                  <Maximize2 size={14} />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2">
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value as string)}
                className={`px-3 py-2 text-sm rounded-xl border transition-all ${
                  isDark
                    ? 'bg-[#0d0b14]/95 border-white/10 text-zinc-100 hover:bg-white/5'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <option
                  value="all"
                  style={{ backgroundColor: isDark ? '#0d0b14' : '#ffffff', color: isDark ? '#e5e7eb' : '#1f2937' }}
                >
                  All Sessions ({sessions.length})
                </option>
                {sessions.map(session => (
                  <option
                    key={session.session_id}
                    value={session.session_id}
                    style={{ backgroundColor: isDark ? '#0d0b14' : '#ffffff', color: isDark ? '#e5e7eb' : '#1f2937' }}
                  >
                    {session.title} ({session.generations.length})
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap items-center gap-2">
                {legendItems.map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-6 h-1 bg-gradient-to-r ${item.color} rounded-full`} />
                    <span className={`text-xs ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Graph canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render edges first (behind nodes) */}
          {edges.map((edge, index) => renderEdge(edge, index))}

          {/* Render nodes */}
          {nodes.map(renderNode)}
        </g>
      </svg>
    </div>
  );
};

export default GraphView;
